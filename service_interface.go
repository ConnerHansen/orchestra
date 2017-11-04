package main

// ServiceInterface the generic service interface
type ServiceInterface interface {
	Accept(interface{}) bool
	Create(newConfig map[string]interface{}, project *ProjectConfiguration) ServiceInterface
	GetID() string
	GetLogs() *ServiceLog
	GetProject() *ProjectConfiguration
	GetState() string
	IsMatch(interface{}) bool
	SetProject(project *ProjectConfiguration)
	Start() bool
	Stop() bool
	Update(map[string]interface{}) error
}
