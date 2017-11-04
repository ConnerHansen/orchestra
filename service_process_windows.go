// +build windows

package main

import (
	"os"
	"os/exec"
)

var defaultTerminal = "cmd"

// haltProcess attempts to halt the specified pid
func haltProcess(proc *os.Process) error {
	return proc.Kill()
}

// setupBaseCommand sets up the base shell command that will execute the
// runnable services code
func setupBaseCommand() *exec.Cmd {
	command := exec.Command(defaultTerminal)

	return command
}
