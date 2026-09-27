// cmd/server/main.go
package main

import (
	"log"
	"os"

	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
	"github.com/KunjJoshi/testlab-mcp/internal/tools"
)

func main() {
	c := &client.Client{
		BaseURL: os.Getenv("TESTLAB_BACKEND_URL"), // e.g. http://localhost:8080
		Token:   os.Getenv("TESTLAB_TOKEN"),       // hardcoded JWT for now, real OAuth later
	}

	s := server.NewMCPServer("testlab", "0.1.0")

	registerSuiteTools(s, c)
	registerTestRowTools(s, c)
	registerAccessTools(s, c)

	if err := server.ServeStdio(s); err != nil {
		log.Fatal(err)
	}
}

func registerSuiteTools(s *server.MCPServer, c *client.Client) {
	tools.RegisterCreateSuiteTool(s, c)
	tools.RegisterGetSuiteByIDTool(s, c)
	tools.RegisterListAllSuitesTool(s, c)
	tools.RegisterUpdateSuiteTool(s, c)
	tools.RegisterDeleteSuiteTool(s, c)
}

func registerTestRowTools(s *server.MCPServer, c *client.Client) {
	tools.RegisterCreateTestRowTool(s, c)
	tools.RegisterBulkImportTestRowsTool(s, c)
	tools.RegisterListTestRowsTool(s, c)
	tools.RegisterUpdateTestRowTool(s, c)
	tools.RegisterDeleteTestRowTool(s, c)
}

func registerAccessTools(s *server.MCPServer, c *client.Client) {
	tools.RegisterProvideAccessTool(s, c)
	tools.RegisterListUsersWithAccessTool(s, c)
	tools.RegisterUpdateAccessTool(s, c)
	tools.RegisterRemoveAccessTool(s, c)
}
