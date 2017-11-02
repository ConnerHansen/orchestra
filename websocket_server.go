package main

import (
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Maximum message size allowed from peer.
	maxMessageSize = 8192

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Time to wait before force close on connection.
	closeGracePeriod = 10 * time.Second
)

var (
	activeUsers    = make(map[*websocket.Conn]*User)
	loggedInUsers  = NewRegistry() /* username -> *User */
	processChannel = make(chan *RunnableServiceConfiguration)
	upgrader       = websocket.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 1024}
)

// OutgoingSocketMessage a message to be sent to a socket
type OutgoingSocketMessage struct {
	Data []interface{}          `json:"data,omitempty"`
	Meta map[string]interface{} `json:"meta,omitempty"`
	Type string                 `json:"type,omitempty"`
}

// IncomingSocketMessage incoming message
type IncomingSocketMessage struct {
	Data []IncomingSocketCommand `json:"data"`
	Meta map[string]interface{}  `json:"meta,omitempty"`
}

// IncomingSocketCommand command
type IncomingSocketCommand struct {
	Data      []interface{} `json:"data,omitempty"`
	ProjectID string        `json:"project_id"`
	ServiceID string        `json:"service_id"`
	Type      string        `json:"type"`
}

// ProjectUpdateMessage sends an update about a project
type ProjectUpdateMessage struct {
	ProjectID string                `json:"project_id"`
	Project   *ProjectConfiguration `json:"project"`
	Status    string                `json:"status"`
	Type      string                `json:"type"`
}

// ServiceStatusMessage a message to convey the current
// status of a particular service
type ServiceStatusMessage struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	Status    string `json:"status"`
	Type      string `json:"type"`
}

// ServiceLogMessage apsodfjkpsdofkpdsogjsdpoigjsdf
type ServiceLogMessage struct {
	Content   string `json:"content"`
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	Type      string `json:"type"`
}

// HandleWebsocket poaskdpoaskd
func HandleWebsocket(rw http.ResponseWriter, req *http.Request) {
	defer req.Body.Close()

	// Make sure this user already has a good token
	username := req.URL.Query().Get("username")
	token := req.URL.Query().Get("token")

	usr, ok := loggedInUsers.Get(username)
	user := usr.(*User)
	if !ok || user.ParseTokenString(token) == nil {
		Error.Println("Error while trying to upgrade connection:",
			"the user does not appear to have a valid token")
		HandleBadRequest(rw)
		return
	}

	// Looks like our request is okay and we know who the user is,
	// continue with the upgrade
	ws, err := upgrader.Upgrade(rw, req, nil)
	if err != nil {
		Error.Println(err)
		return
	}

	// We're active, track it
	Debug.Println("Socket opened")

	// user.Subscribe(Config.Projects["Ecco"])
	activeUsers[ws] = user
	user.Socket = ws

	done := make(chan struct{})
	go ping(ws, done)

	defer ws.Close()

	// dumpExistingData(&user)
	user.StartMessageListener()

	// Socket is no longer active, remove it
	Debug.Println("Socket closed")
	delete(activeUsers, ws)
}

// dumpExistingData dumps the current backlog of data when a new socket
// comes online
func dumpExistingData(user *User) {
	for _, project := range Config.Projects {
		for _, service := range project.Services {
			genericService := service.(ServiceInterface)
			if genericService.GetState() == ServiceRunning {
				user.WriteStatusMessage(genericService.GetState(), genericService)
			}

			if genericService.GetLogs() != nil {
				user.WriteServiceData(genericService)
			}
		}
	}
}

// listenForProcessData sets up a listener on the channel for process output
func listenForProcessData() {
	for {
		select {
		case src := <-processChannel:
			for socket, user := range activeUsers {
				if socket != nil {
					user.WriteServiceData(src)
				} else {
					Error.Println("An active user somehow has a nil socket...")
				}
			}
		}
	}
}

// ForEachActiveUser performs the callback function on each currently active
// user session
func ForEachActiveUser(action func(*User)) {
	for socket, user := range activeUsers {
		if socket != nil {
			action(user)
		}
	}
}

func broadcastProcessData(src interface{}) {
	for socket, user := range activeUsers {
		if socket != nil {
			user.WriteServiceData(src)
		}
	}
}

func broadcastProjectUpdate(project *ProjectConfiguration) {
	for socket, user := range activeUsers {
		if socket != nil {
			user.WriteProjectMessage(project)
		}
	}
}

func broadcastProjectRemoval(project *ProjectConfiguration) {
	for socket, user := range activeUsers {
		if socket != nil {
			user.WriteRemovalMessage(project)
		}
	}
}

// ping performs the basic ping logic to keep the websocket alive
func ping(ws *websocket.Conn, done chan struct{}) {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if err := ws.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(writeWait)); err != nil {
				Error.Println("Error while attempting to ping websocket:", err)
				return
			}
		case <-done:
			return
		}
	}
}
