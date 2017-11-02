package main

import (
	"encoding/json"
	"errors"
	"sync"
	"time"

	jwt "github.com/dgrijalva/jwt-go"
	"github.com/gorilla/websocket"
)

// User the user struct for referencing user stuff
type User struct {
	Metadata           map[string]interface{}
	Mutex              *sync.Mutex
	Secret             []byte
	SubscribedProjects map[string]ProjectSubscription
	Socket             *websocket.Conn
	Token              *jwt.Token
	Username           string
}

// UserLogin is a simple struct for storing the results
// of a login attempt
type UserLogin struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// ProjectSubscription the struct to track what
// projects a user is currenly subscribed to
type ProjectSubscription struct {
	Mutex              *sync.Mutex
	Project            *ProjectConfiguration
	SubscribedServices map[string]ServiceSubscription
}

// ServiceSubscription the struct tracking the current
// service subscriptions and where their readers are
type ServiceSubscription struct {
	ReadPointer *ServiceLogEntry
	Service     *ServiceInterface
}

// NewUser makes a new user instance and binds it to a particular
// websocket pointer
func NewUser(socket *websocket.Conn) *User {
	secret, err := GenerateSecureRandomBytes(32)
	if err != nil {
		Error.Println("Something went wrong while generating the secure key for a user!", err)

		// Make sure we at least have something instead of nothing
		secret = []byte(GenerateRandomString(32))
	}

	u := &User{
		Metadata:           make(map[string]interface{}),
		Mutex:              &sync.Mutex{},
		Secret:             secret,
		Socket:             socket,
		SubscribedProjects: make(map[string]ProjectSubscription)}

	for _, project := range Config.Projects {
		u.Subscribe(project)
	}

	return u
}

// CreateNewToken generates a new token for the current user
func (u *User) CreateNewToken() *jwt.Token {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"exp":    time.Now().Add(72 * time.Hour).Unix(),
		"nbf":    time.Now().Unix(),
		"ref_at": time.Now().Add(5 * time.Minute).Unix(),
	})
}

func (u *User) handleMessage(message *IncomingSocketMessage) {
	if tokenString, ok := message.Meta["token"]; ok {
		token := u.ParseTokenString(tokenString.(string))

		if token != nil {
			// We've already had to go through this casting once, so it has to
			// be safe here
			claims, _ := token.Claims.(jwt.MapClaims)

			if claims.VerifyExpiresAt(time.Now().Unix(), true) &&
				claims.VerifyNotBefore(time.Now().Unix(), true) {
				for _, entry := range message.Data {
					processCommand(entry, u)
				}
			} else {
				// Ignore the commands -- we should probably drop the socket
				// here too and force a reconnection
				Error.Println("Something was wrong with the dang token claims:", claims)
			}
		}
	} else {
		Error.Println("The users token is either unset or invalid!")
	}
}

// parseToken is a private utility function to aide in parsing the tokens
// being returned by clients
func (u *User) parseToken(token *jwt.Token) (interface{}, error) {
	if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
		return nil, errors.New("Signing method was not recognized")
	}

	return u.Secret, nil
}

// ParseTokenString takes in a token string and attempts to parse it back
// into a valid token
func (u *User) ParseTokenString(tokenString string) *jwt.Token {
	token, err := jwt.Parse(tokenString, u.parseToken)

	if err != nil {
		Error.Println("It looks like the token is invalid:", err)
	} else {
		if _, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
			return token
		}

		Error.Println("Either the claims are the wrong type or the token was invalid")
	}

	return nil
}

// ResetSubscription resets the reader
func (u *User) ResetSubscription(s interface{}) {
	service := s.(ServiceInterface)

	if projSub, ok := u.SubscribedProjects[service.GetProject().Name]; ok {
		if servSub, ok := projSub.SubscribedServices[service.GetID()]; ok {
			servSub.ReadPointer = nil
			projSub.SubscribedServices[service.GetID()] = servSub
		} else {
			var headPointer *ServiceLogEntry
			if service.GetLogs() != nil {
				headPointer = service.GetLogs().Root
			}

			servSub := ServiceSubscription{
				Service:     &service,
				ReadPointer: headPointer}
			projSub.SubscribedServices[service.GetID()] = servSub
		}

		u.SubscribedProjects[service.GetProject().Name] = projSub
	}
}

// StartMessageListener sets up a listener for
func (u *User) StartMessageListener() {
	defer u.Socket.Close()
	u.Socket.SetReadLimit(maxMessageSize)
	u.Socket.SetReadDeadline(time.Now().Add(pongWait))
	u.Socket.SetPongHandler(func(string) error { u.Socket.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, data, err := u.Socket.ReadMessage()
		if err != nil {
			// Only log the error if this was an unexpected event. Websockets going away
			// is normal and expected, so don't log it as an error
			logError := true
			if closeErr, ok := err.(*websocket.CloseError); ok {
				if closeErr.Code == websocket.CloseGoingAway {
					logError = false
					Debug.Println("Websocket for", u.Username, "has closed")
				}
			}

			if logError {
				// Wasn't a known type, so it was a true error
				Error.Println("There was an error while reading the websocket message:", err)
			}

			break
		} else {
			var incomingMessage IncomingSocketMessage
			err = json.Unmarshal(data, &incomingMessage)
			if err != nil {
				Error.Println(err)
			} else {
				u.handleMessage(&incomingMessage)
			}
		}
	}
}

// Subscribe subscribes the user to the specified project configuration and
// therefore any services under that project
func (u *User) Subscribe(project *ProjectConfiguration) {
	projSubscription := ProjectSubscription{
		Mutex:              &sync.Mutex{},
		Project:            project,
		SubscribedServices: make(map[string]ServiceSubscription)}

	for _, service := range project.Services {
		var headPointer *ServiceLogEntry
		wrapper := service.(ServiceInterface)

		if wrapper.GetLogs() != nil {
			headPointer = wrapper.GetLogs().Root
		}

		servSub := ServiceSubscription{
			Service:     &wrapper,
			ReadPointer: headPointer,
		}
		projSubscription.SubscribedServices[wrapper.GetID()] = servSub
	}

	u.SubscribedProjects[project.Name] = projSubscription
}

// tokenNeedsRefresh tests whether or not the current user token is in need
// of being refreshed
func (u *User) tokenNeedsRefresh() bool {
	if u.Token != nil {
		if claims, ok := u.Token.Claims.(jwt.MapClaims); ok {
			return claims["ref_at"].(int64) < time.Now().Unix()
		}
	}

	// If there's no token or there's something wrong with the
	// claims, we should get a new token
	return true
}

// TokenString generates a new token string for the current user
func (u *User) TokenString() string {
	if u.tokenNeedsRefresh() {
		Debug.Println("User is missing a token, generating a new one...")
		// Create a new token for each request?
		u.Token = u.CreateNewToken()
	}

	tokenString, err := u.Token.SignedString(u.Secret)
	if err != nil {
		Error.Println("Error while signing the token:", err)
		return ""
	}

	return tokenString
}

// Unsubscribe removes a user from a project subscription
func (u *User) Unsubscribe(project *ProjectConfiguration) {
	if _, ok := u.SubscribedProjects[project.Name]; ok {
		delete(u.SubscribedProjects, project.Name)
	}
}

// WriteServiceData will dump stuff
func (u *User) WriteServiceData(s interface{}) {
	service := s.(ServiceInterface)

	if projectSubscription, ok := u.SubscribedProjects[service.GetProject().Name]; ok {
		// TODO: rethink this travesty
		// Project the project from concurrent updates
		projectSubscription.Mutex.Lock()
		defer projectSubscription.Mutex.Unlock()

		if serviceSubscription, ok := projectSubscription.SubscribedServices[service.GetID()]; ok {
			isFirst := serviceSubscription.ReadPointer == nil
			if isFirst {
				serviceSubscription.ReadPointer = service.GetLogs().Root
			}

			if serviceSubscription.ReadPointer != nil {
				// If this is the first line, make sure we don't skip it. Otherwise,
				// we'll always want to start on the next line available
				var reader *ServiceLogEntry
				if isFirst {
					reader = serviceSubscription.ReadPointer
				} else {
					reader = serviceSubscription.ReadPointer.Next
				}
				blob := ""

				// Now walk the reader struct until we hit a null pointer. Since everything
				// is driven by pointers, we shouldn't have any risk of a partially written
				// record, so we won't need to worry about mutexes here
				for reader != nil {
					if blob == "" {
						blob = reader.Line
					} else {
						blob = blob + "\n" + reader.Line
					}

					serviceSubscription.ReadPointer = reader
					projectSubscription.SubscribedServices[service.GetID()] = serviceSubscription
					reader = reader.Next
				}

				// u.SubscribedProjects[service.GetProject().Name] = projectSubscription
				// TODO: migrate WriteLogMessage to operate as a batch send
				u.WriteLogMessage(blob, service)
			}
		}
	}
}

// WriteProjectMessage writes the status message for a given service
func (u *User) WriteProjectMessage(project *ProjectConfiguration) {
	u.WriteJSON("project_update_message", ProjectUpdateMessage{
		ProjectID: project.ID,
		Project:   project,
		Status:    "updated",
		Type:      "project_update_message",
	})
}

// WriteRemovalMessage writes the status message for a given service
func (u *User) WriteRemovalMessage(project *ProjectConfiguration) {
	u.WriteJSON("project_removal_message", ProjectUpdateMessage{
		ProjectID: project.ID,
		Project:   project,
		Status:    "removed",
		Type:      "project_removal_message",
	})
}

// WriteStatusMessage writes the status message for a given service
func (u *User) WriteStatusMessage(status string, s interface{}) {
	service := s.(ServiceInterface)

	u.WriteJSON("service_status_message", ServiceStatusMessage{
		Status:    status,
		ID:        service.GetID(),
		ProjectID: service.GetProject().ID,
		Type:      "service_status_message",
	})
}

// WriteLogMessage writes a log message for a service to the specified socket
func (u *User) WriteLogMessage(data string, s interface{}) {
	service := s.(ServiceInterface)

	u.WriteJSON("service_log_message", ServiceLogMessage{
		Content:   data,
		ID:        service.GetID(),
		ProjectID: service.GetProject().ID,
		Type:      "service_log_message",
	})
}

// WriteJSON writes the passed struct to the socket
func (u *User) WriteJSON(messageType string, data interface{}) {
	u.Mutex.Lock()
	u.Metadata["token"] = u.TokenString()

	u.Socket.WriteJSON(OutgoingSocketMessage{
		Data: []interface{}{data},
		Meta: u.Metadata,
		Type: messageType,
	})
	u.Mutex.Unlock()
}
