package main

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"math/rand"
	"net/http"
	"regexp"
	"strconv"
	"sync"
	"time"
)

type MockeryServiceConfiguration struct {
	Configurations []*MockeryRuleConfiguration `json:"configurations"`
	Description    string                      `json:"description"`
	DelayAfter     int                         `json:"delay_after"`
	DelayBefore    int                         `json:"delay_before"`
	ID             string                      `json:"id"`
	Name           string                      `json:"name"`
	Port           string                      `json:"port"`
	Process        *MockeryProcess             `json:"-"`
	Project        *ProjectConfiguration       `json:"-"`
	Running        bool                        `json:"-"`
	State          string                      `json:"-"`
	Type           string                      `json:"type"`
}

type MockeryProcess struct {
	Channel       chan int
	Configuration *MockeryServiceConfiguration
	Logs          *ServiceLog
	Mutex         *sync.Mutex
	Server        *http.Server
}

type MockeryRuleConfiguration struct {
	Active bool            `json:"active,omitempty"`
	Name   string          `json:"name"`
	Rules  []*MockeryRules `json:"rules"`
}

type MockeryRules struct {
	Body        string `json:"body"`
	ContentType string `json:"content_type"`
	Order       int    `json:"order,omitempty"`
	Regex       string `json:"regex"`
	StatusCode  int    `json:"status_code"`
}

func (s *MockeryServiceConfiguration) Accept(src interface{}) bool {
	switch src.(type) {
	case *MockeryServiceConfiguration:
		return true
	case map[string]interface{}:
		config := src.(map[string]interface{})
		if val, ok := config["type"]; ok {
			if val.(string) == TypeMockeryService {
				return true
			}
		}
	}

	return false
}

func (s *MockeryServiceConfiguration) Create(newConfig map[string]interface{}, project *ProjectConfiguration) ServiceInterface {
	runnable := &MockeryServiceConfiguration{}
	runnable.Update(newConfig)
	runnable.Project = project

	return runnable
}

func (s *MockeryServiceConfiguration) GetID() string {
	return s.ID
}

func (s *MockeryServiceConfiguration) GetLogs() *ServiceLog {
	if s.Process != nil {
		return s.Process.Logs
	}

	return nil
}

func (s *MockeryServiceConfiguration) GetProject() *ProjectConfiguration {
	return s.Project
}

func (s *MockeryServiceConfiguration) GetState() string {
	return s.State
}

// GenerateID generates a new ID
func (m *MockeryServiceConfiguration) GenerateID() {
	Debug.Println("Generating ID")
	rand.Seed(time.Now().UnixNano())

	chars := make([]rune, 24)
	for i := range chars {
		chars[i] = letterRunes[rand.Intn(len(letterRunes))]
	}

	m.ID = string(chars)
}

func (m *MockeryServiceConfiguration) IsMatch(config interface{}) bool {
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
	return m.ID != "" && m.ID == configID
}

func (m *MockeryServiceConfiguration) Start() bool {
	if !m.Running {
		m.Process = &MockeryProcess{
			Configuration: m,
			Logs:          &ServiceLog{},
			Mutex:         &sync.Mutex{}}

		m.Process.Start()
		m.State = ServiceRunning

		for socket, user := range activeUsers {
			if socket != nil {
				Info.Println("Telling users about", m.Name)
				user.ResetSubscription(m)
				user.WriteStatusMessage(m.State, m)
				// activeUsers[socket] = user
			}
		}

		return true
	}

	return false
}

func (m *MockeryServiceConfiguration) Stop() bool {
	if m.Running && m.Process != nil {
		m.Process.Stop()
		m.State = ServiceStopped
		m.Running = false
		return true
	}

	return false
}

func (m *MockeryServiceConfiguration) GetActiveConfiguration() (*MockeryRuleConfiguration, int) {
	for i, config := range m.Configurations {
		if config.Active {
			return config, i
		}
	}

	return nil, -1
}

func (m *MockeryProcess) Start() {
	m.Mutex.Lock()

	if m.Server == nil {
		mux := http.NewServeMux()
		mux.HandleFunc("/", func(rw http.ResponseWriter, req *http.Request) {
			defer req.Body.Close()

			var val string
			var payload string
			// matched := false
			body := "<html><body>Could not match endpoint</body></html>"
			contentType := "text/html"
			matchedRule := ""
			statusCode := 404

			data, err := ioutil.ReadAll(req.Body)
			if err != nil {
				Error.Println("Error while running mock service:", err)
				payload = ""
			} else {
				payload = string(data)
			}

			activeConfig, _ := m.Configuration.GetActiveConfiguration()
			if activeConfig != nil {
				for _, rule := range activeConfig.Rules {
					regexMatch, _ := regexp.MatchString(rule.Regex, req.RequestURI)
					if rule.Regex == "*" || regexMatch {
						body = rule.Body
						contentType = rule.ContentType
						statusCode = rule.StatusCode
						matchedRule = rule.Regex

						// matched, break!
						break
					}
				}
			}

			val = "Path: " + req.RequestURI + "\n" +
				"Request Type: " + req.Method + "\n" +
				"Matched Rule: " + matchedRule + "\n" +
				"Incoming Payload: " + payload + "\n" +
				"Response Status Code: " + strconv.Itoa(statusCode) + "\n" +
				"Response Content Type: " + contentType + "\n" +
				"Response Payload: " + body + "\n" +
				"<br/>\n"

			m.Logs.Append(val)
			broadcastProcessData(m.Configuration)

			rw.Header().Set("Content-Type", contentType)
			rw.WriteHeader(statusCode)
			rw.Write([]byte(body))
		})

		srv := &http.Server{Addr: ":" + m.Configuration.Port}
		srv.Handler = mux

		go func() {
			m.Logs.Append("Starting up new Mockery Service against port: " + m.Configuration.Port)
			broadcastProcessData(m.Configuration)
			if err := srv.ListenAndServe(); err != nil {
				if err.Error() != "http: Server closed" {
					Error.Println("Error while serving mockery service:", err)
					m.Configuration.State = ServiceDead
				} else {
					m.Configuration.State = ServiceStopped
				}

				m.Logs.Append("Service has exited")
				broadcastProcessData(m.Configuration)
			} else {
				m.Configuration.State = ServiceStopped
				Debug.Println("Mockery service has halted")
			}

			// We just shut down the server, clear it out
			m.Server = nil

			for socket, user := range activeUsers {
				if socket != nil {
					user.WriteStatusMessage(m.Configuration.State, m.Configuration)
				} else {
					Warn.Println("User somehow has a missing socket")
				}
			}
		}()

		m.Configuration.Running = true
		m.Server = srv
	}

	m.Mutex.Unlock()
}

func (m *MockeryProcess) Stop() {
	m.Mutex.Lock()

	if m.Configuration.Running {
		m.Server.Shutdown(context.Background())
	}

	m.Mutex.Unlock()
}

// Update updates the service configuration
func (m *MockeryServiceConfiguration) Update(newConfig map[string]interface{}) error {
	if m.GetState() == ServiceRunning {
		return ErrorCannotModifyService
	}

	data, err := json.Marshal(newConfig)
	if err != nil {
		Error.Println("Error while loading new mockery service:", err)
		return err
	}

	var shimService *MockeryServiceConfiguration
	err = json.Unmarshal(data, &shimService)
	if err != nil {
		Error.Print("Error while unmarshaling new mockery service", err, string(data))
		return err
	}

	m.DelayAfter = shimService.DelayAfter
	m.DelayBefore = shimService.DelayBefore
	m.Description = shimService.Description
	if shimService.ID != "" {
		m.ID = shimService.ID
	}

	if shimService.Name != "" {
		m.Name = shimService.Name
	}

	if shimService.Port != "" {
		m.Port = shimService.Port
	}

	if shimService.Configurations != nil {
		_, index := m.GetActiveConfiguration()

		// Only try to fix the index if the incoming service isn't tracking it
		if _, shimIndex := shimService.GetActiveConfiguration(); shimIndex == -1 {
			// Try to retain the active configuration index -- this will be
			// prone to errors once we allow reordering. We should allow the
			// services themselves to report whether they're active or not
			if len(m.Configurations) <= len(shimService.Configurations) {
				if index == -1 {
					if len(shimService.Configurations) > 0 {
						shimService.Configurations[0].Active = true
					}
				} else {
					shimService.Configurations[index].Active = true
				}
			}
		}

		m.Configurations = shimService.Configurations
	}

	// Okay, if we still don't have an ID, generate it
	if m.ID == "" {
		m.GenerateID()
	}

	// And lastly, make sure the type is set
	m.Type = TypeMockeryService

	return nil
}
