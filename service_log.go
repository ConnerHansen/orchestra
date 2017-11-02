package main

// ServiceLog the struct for the historical log messages for a service
type ServiceLog struct {
	Head        *ServiceLogEntry
	LineCount   int
	ReadPointer *ServiceLogEntry
	Root        *ServiceLogEntry `json:"root"`
}

// ServiceLogEntry stores a line with a block of additional messages
type ServiceLogEntry struct {
	Line string           `json:"line"`
	Next *ServiceLogEntry `json:"next,omitempty"`
}

// Append appends a string to the logs
func (s *ServiceLog) Append(msg string) {
	entry := ServiceLogEntry{Line: msg}

	if s.ReadPointer == nil {
		s.ReadPointer = &entry
		s.Root = &ServiceLogEntry{Next: &entry}
		s.Head = &entry
	} else {
		s.Head.Next = &entry
		s.Head = &entry
	}

	if s.LineCount >= ServiceDefaultHistoryLimit {
		if s.ReadPointer == s.Root {
			s.ReadPointer = s.Root.Next
		}

		s.Root = s.Root.Next
		s.LineCount--
	}

	s.LineCount++
}
