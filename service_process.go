package main

import (
	"bufio"
	"bytes"
	"io"
	"log"
	"os/exec"
	"runtime/debug"
	"sync"
)

// ServiceProcess the struct for holding the currently running service process
type ServiceProcess struct {
	Channel       chan string
	Command       *exec.Cmd
	Configuration *RunnableServiceConfiguration
	Error         io.ReadCloser
	Input         io.WriteCloser
	Logs          *ServiceLog
	Mutex         *sync.Mutex
	Output        io.ReadCloser
	Running       bool
}

// NewServiceProcess creates a new, runnable service process
func NewServiceProcess(cmd *exec.Cmd, config *RunnableServiceConfiguration, reader, err io.ReadCloser, writer io.WriteCloser) *ServiceProcess {
	// Make sure we buffer our channel so if we get flooded we won't block stdin
	return &ServiceProcess{
		Channel:       make(chan string, 1000),
		Command:       cmd,
		Configuration: config,
		Logs:          &ServiceLog{},
		Mutex:         &sync.Mutex{},
		Error:         err,
		Input:         writer,
		Output:        reader,
		Running:       true}
}

// Cleanup closes all the channels and pipes for an executing process then flags it
// as no longer running
func (s *ServiceProcess) Cleanup() error {
	var err error

	if s.Running {
		// Channels are dangerous in this situation since we might attempt to close
		// a process multiple times (ie the process isn't dying right), so expect
		// to possibly handle a panic here
		defer func() {
			if r := recover(); r != nil {
				Error.Println("PANIC", r.(error), bytes.NewBuffer(debug.Stack()).String())
			}
		}()
		defer close(s.Channel)
		s.Channel = nil

		// Cleanup the pipe readers and writers for the process
		err = s.Error.Close()
		if err != nil {
			return err
		}

		err = s.Input.Close()
		if err != nil {
			return err
		}

		err = s.Output.Close()
		if err != nil {
			return err
		}
	}

	return err
}

// Kill stops the service process if it's running and then issues the cleanup command
// on the various channels and pipes
func (s *ServiceProcess) Kill() {
	Debug.Println("Kill called against", s.Configuration.Name)
	err := haltProcess(s.Command.Process)
	if err != nil {
		Error.Println("Could not kill process:", err)
	}
}

// Start initializes the process and starts it up, returning a new pointer
// to a service process
func (s *ServiceProcess) Start(config *RunnableServiceConfiguration) *ServiceProcess {
	command := setupBaseCommand()

	inputPipe, err := command.StdinPipe()
	if err != nil {
		log.Fatal(err)
	}

	outputPipe, err := command.StdoutPipe()
	if err != nil {
		log.Fatal(err)
	}

	errorPipe, err := command.StderrPipe()
	if err != nil {
		log.Fatal(err)
	}

	s = NewServiceProcess(command, config, outputPipe, errorPipe, inputPipe)

	go s.StartChannelListener()
	go s.StartErrorListener()
	go s.StartOutputListener()
	go s.StartExitListener()

	// TODO: refactor this away from the config since it's been moved into the process
	// Now, start this guy up
	s.WriteString("cd " + s.Configuration.WorkingDir)
	for _, cmd := range s.Configuration.Commands {
		s.WriteString(cmd)
	}

	// Now make sure the terminal quits when finished (ie if it isn't blocking)
	s.WriteString("exit")

	return s
}

// StartChannelListener begins listening to the service processes channel in order
// to broadcast the messages to active users
func (s *ServiceProcess) StartChannelListener() {
	defer func() {
		if r := recover(); r != nil {
			Error.Println("PANIC", r.(error), bytes.NewBuffer(debug.Stack()).String())
		}
	}()

	// Halt once we're not running anymore
	for s.Running && s.Channel != nil {
		select {
		case line, ok := <-s.Channel:
			if !ok {
				Debug.Println("It appears the channel closed, exiting the listener")
				break
			}

			ForEachActiveUser(func(user *User) {
				user.WriteLogMessage(line, s.Configuration)
			})
		}
	}
}

// StartOutputListener starts the stdin listener
func (s *ServiceProcess) StartOutputListener() {
	reader := bufio.NewReader(s.Output)

	Info.Println("Starting stdout listener for", s.Configuration.Name)
	for {
		lines, _, err := reader.ReadLine()

		if err != nil {
			Info.Println("Exiting the stdout listener for", s.Configuration.Name)
			break
		}

		s.Channel <- string(lines)
	}
}

// StartErrorListener starts the stderr listener
func (s *ServiceProcess) StartErrorListener() {
	reader := bufio.NewReader(s.Error)

	Debug.Println("Starting error listener for", s.Configuration.Name)
	for {
		lines, _, err := reader.ReadLine()
		if err != nil {
			Debug.Println("Exiting the error listener for", s.Configuration.Name)
			break
		}

		s.Channel <- string(lines)
	}
}

// StartExitListener starts the gofunc that listens for the running process
// to complete its execution
func (s *ServiceProcess) StartExitListener() {
	err := s.Command.Start()
	if err != nil {
		Error.Println("Error while attempting to start the command:", err)
	} else {
		// Now start the process listener
		go func() {
			Debug.Println("Waiting for process exit for", s.Configuration.Name)
			err := s.Command.Wait()

			// Command must have exited, update our status
			s.Configuration.Running = false
			s.Configuration.State = ServiceStopped

			if err != nil {
				// Only signal that it's dead rather than stopped if this wasn't us
				// issuing a sigkill
				if err.Error() != "signal: killed" {
					s.Configuration.State = ServiceDead
					Error.Println(s.Configuration.Name, err)
				}
			}

			Debug.Println("It appears that the process for", s.Configuration.Name, "has exited")
			// Now, cleanup the running process, shutoff its channel and pipes, then make
			// sure we mark it as done
			s.Cleanup()
			s.Running = false

			ForEachActiveUser(func(user *User) {
				user.WriteStatusMessage(s.Configuration.State, s.Configuration)
			})
		}()
	}
}

// Write writes the specified data to the service configuration if it's running
func (s *ServiceProcess) Write(data []byte) bool {
	if s.Running {
		_, err := s.Input.Write(data)
		if err != nil {
			Error.Println(err)
			return false
		}

		return true
	}

	return false
}

// WriteString writes the specified string to the service configuration if
// it's running
func (s *ServiceProcess) WriteString(data string) bool {
	return s.Write([]byte(data + "\n"))
}
