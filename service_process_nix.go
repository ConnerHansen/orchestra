// +build darwin linux

package main

import (
	"os"
	"os/exec"
	"syscall"
)

var defaultTerminal = "bash"

// haltProcess attempts to halt the specified pid
func haltProcess(proc *os.Process) error {
	// Kill the process and all of its children, we want to take out everything
	return syscall.Kill(-proc.Pid, syscall.SIGKILL)
}

// setupBaseCommand sets up the base shell command that will execute the
// runnable services code
func setupBaseCommand() *exec.Cmd {
	command := exec.Command(defaultTerminal)
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	return command
}
