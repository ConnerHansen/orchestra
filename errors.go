package main

import "errors"

const (
	// ErrorLevelError the error level for errors
	ErrorLevelError = "error"

	// ErrorLevelInfo the error level for infos
	ErrorLevelInfo = "info"

	// ErrorLevelWarn the error level for warnings
	ErrorLevelWarn = "warn"

	// ErrorTypeUpdateWarning update warning
	ErrorTypeUpdateWarning = "update_warning"

	// ErrorTypeUpdateFailure update failure
	ErrorTypeUpdateFailure = "update_failure"

	// ErrorTypeGenericError the generic error type
	ErrorTypeGenericError = "error"
)

var (
	// ErrorNameAlreadyTaken the error for when a name was already taken
	ErrorNameAlreadyTaken = errors.New("The name was already taken")

	// ErrorCannotModifyProject the error for when a project cannot be modified
	ErrorCannotModifyProject = errors.New("The project is runnign and cannot be modified")

	// ErrorCannotModifyService the error for when a service cannot be modified
	ErrorCannotModifyService = errors.New("The service is running and cannot be modified")

	// ErrorCannotMatchProject the error for when a project update cannot be matched
	ErrorCannotMatchProject = errors.New("The project could not be matched")

	// ErrorCannotMatchService the error for when a service update cannot be matched
	ErrorCannotMatchService = errors.New("The service could not be matched")

	// ErrorCannotParsePayload the error for when we don't know what the fuck someone
	// is trying to tell us
	ErrorCannotParsePayload = errors.New("The payload could not be understood by the server")
)

// ErrorReport reports an error
type ErrorReport struct {
	Level   string `json:"level"`
	Message string `json:"message"`
	Type    string `json:"type"`
}
