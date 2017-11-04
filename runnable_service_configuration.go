package main

import (
	"bytes"
	"encoding/json"
	"log"
	"os"
	"os/exec"
)

const (
	// ServiceDefaultHistoryLimit is the constant that defines just how
	// many historical lines to retain so when a new consumer jumps on
	// it gets at least some of the logging history
	ServiceDefaultHistoryLimit = 200

	// ServiceDead when the service is dead
	ServiceDead = "dead"

	// ServiceRunning the service is running
	ServiceRunning = "running"

	// ServiceFailed the service has failed and is dead
	ServiceFailed = "failed"

	// ServiceStopped the service is not currently running and is
	// also not in an error condition
	ServiceStopped = "stopped"
)

// RunnableServiceConfiguration the struct for storing a particular configuration
type RunnableServiceConfiguration struct {
	Branch      string                `json:"branch"`
	Commands    []string              `json:"commands"`
	Description string                `json:"description"`
	DelayAfter  int                   `json:"delay_after"`
	DelayBefore int                   `json:"delay_before"`
	ID          string                `json:"id"`
	Name        string                `json:"name"`
	Process     *ServiceProcess       `json:"-"`
	Project     *ProjectConfiguration `json:"-"`
	Repository  string                `json:"repository,omitempty"`
	Running     bool                  `json:"-"`
	State       string                `json:"-"`
	Type        string                `json:"type"`
	WorkingDir  string                `json:"working_dir"`
}

// Accept tests if this interface is a RunnableServiceConfiguration or a map
// of a RunnableServiceConfiguration
func (s *RunnableServiceConfiguration) Accept(src interface{}) bool {
	switch src.(type) {
	case *RunnableServiceConfiguration:
		Debug.Println("Type is runnable")
		return true
	case map[string]interface{}:
		config := src.(map[string]interface{})
		if val, ok := config["type"]; ok {
			if val.(string) == TypeRunnableService {
				Debug.Println("Type is runnable (map)")
				return true
			}
		}
	}

	return false
}

// Create creates a new RunnableServiceConfiguration from the provided interface
func (s *RunnableServiceConfiguration) Create(newConfig map[string]interface{}, project *ProjectConfiguration) ServiceInterface {
	runnable := &RunnableServiceConfiguration{}
	runnable.Update(newConfig)
	runnable.Project = project

	return runnable
}

// GenerateID generates a new ID
func (s *RunnableServiceConfiguration) GenerateID() {
	s.ID = GenerateServiceID()
}

// GetID returns the ID of the configuration
func (s *RunnableServiceConfiguration) GetID() string {
	return s.ID
}

// GetLogs returns the current set of logs for the process if it exists
func (s *RunnableServiceConfiguration) GetLogs() *ServiceLog {
	if s.Process != nil {
		return s.Process.Logs
	}

	return nil
}

// GetProject returns the current project of the service
func (s *RunnableServiceConfiguration) GetProject() *ProjectConfiguration {
	return s.Project
}

// GetState returns the current state of the service
func (s *RunnableServiceConfiguration) GetState() string {
	return s.State
}

// GetBranch returns the current branch
func (s *RunnableServiceConfiguration) GetBranch() string {
	dir := s.GetWorkingDir()
	branch := ""
	cmd := exec.Command(`bash -c "cd ` + dir + `; git branch | grep \"*\""`)

	out, err := cmd.Output()

	if err != nil {
		Error.Println("Error while running the command:", err)
	} else {
		branch = bytes.NewBuffer(out).String()
	}

	return branch
}

// GetWorkingDir returns the current working directory, either based on the
// configuration or inferred from the execution directory
func (s *RunnableServiceConfiguration) GetWorkingDir() string {
	if s.WorkingDir == "" {
		dir, err := os.Getwd()

		if err != nil {
			Error.Fatal(err)
		} else {
			Debug.Println("No working dir was set, inferring working dir of:", dir)
			s.WorkingDir = dir
		}
	}

	return s.WorkingDir
}

// IsMatch determines if this interface is a RunnableServiceConfiguration
func (s *RunnableServiceConfiguration) IsMatch(config interface{}) bool {
	var configID string

	switch config.(type) {
	case ServiceInterface:
		configID = config.(ServiceInterface).GetID()
	case map[string]interface{}:
		if id, ok := config.(map[string]interface{})["id"]; ok {
			configID = id.(string)
		}
	case string:
		configID = config.(string)
	}

	// Return if the IDs are not empty and equal
	return s.ID != "" && s.ID == configID
}

// SetProject assigns the project to this configuration
func (s *RunnableServiceConfiguration) SetProject(project *ProjectConfiguration) {
	s.Project = project
}

// Start starts a thing
func (s *RunnableServiceConfiguration) Start() bool {
	s.WorkingDir = s.GetWorkingDir()

	Info.Println("Starting up", s.Name)
	s.Process = s.Process.Start(s)
	s.State = ServiceRunning

	for socket, user := range activeUsers {
		if socket != nil {
			Info.Println("Telling users about", s.Name)
			user.ResetSubscription(s)
			user.WriteStatusMessage(s.State, s)
			activeUsers[socket] = user
		}
	}

	s.Running = true
	return s.Running
}

// Stop stops the service configuration if it's running
func (s *RunnableServiceConfiguration) Stop() bool {
	if s.Running {
		s.Process.Kill()
		s.Running = false

		return true
	}

	log.Println("Stop called on a non-running service configuration")
	return false
}

// Update updates the service configuration
func (s *RunnableServiceConfiguration) Update(newConfig map[string]interface{}) error {
	if s.Running {
		return ErrorCannotModifyService
	}

	data, err := json.Marshal(newConfig)
	if err != nil {
		Error.Println("Error while loading new runnable service:", err)
		return err
	}

	var shimService *RunnableServiceConfiguration
	err = json.Unmarshal(data, &shimService)
	if err != nil {
		Error.Print("Error while unmarshaling new runnable service", err)
		return err
	}

	s.DelayAfter = shimService.DelayAfter
	s.DelayBefore = shimService.DelayBefore
	s.Description = shimService.Description

	if shimService.Name != "" {
		s.Name = shimService.Name
	}

	if shimService.Branch != "" {
		s.Branch = shimService.Branch
	}

	if shimService.Commands != nil {
		s.Commands = shimService.Commands
	}

	if shimService.Repository != "" {
		s.Repository = shimService.Repository
	}

	if shimService.WorkingDir != "" {
		s.WorkingDir = shimService.WorkingDir
	}

	// Make sure we even have an ID
	if s.ID == "" {
		s.GenerateID()
	}

	s.Type = TypeRunnableService
	return nil
}
