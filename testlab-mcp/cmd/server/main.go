// cmd/server/main.go
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/auth"
	"github.com/KunjJoshi/testlab-mcp/internal/client"
	"github.com/KunjJoshi/testlab-mcp/internal/tools"
)

func main() {

	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on environment variables")
	}

	log.Printf("TESTLAB_BACKEND_URL=%q MCP_SELF_URL=%q PORT=%q",
		os.Getenv("TESTLAB_BACKEND_URL"), os.Getenv("MCP_SELF_URL"), os.Getenv("PORT"))

	c := &client.Client{
		BaseURL: os.Getenv("TESTLAB_BACKEND_URL"),
	}

	s := server.NewMCPServer("testlab", "0.1.0")
	registerAllTools(s, c)

	// cmd/server/main.go
	streamable := server.NewStreamableHTTPServer(s, server.WithStateLess(true))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /.well-known/oauth-protected-resource", auth.ProtectedResourceMetadata)
	mux.Handle("/mcp", auth.RequireBearerToken(streamable))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("testlab-mcp listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func registerAllTools(s *server.MCPServer, c *client.Client) {
	tools.RegisterCreateSuiteTool(s, c)
	tools.RegisterGetSuiteByIDTool(s, c)
	tools.RegisterListAllSuitesTool(s, c)
	tools.RegisterUpdateSuiteTool(s, c)
	tools.RegisterDeleteSuiteTool(s, c)
	tools.RegisterCreateTestRowTool(s, c)
	tools.RegisterBulkImportTestRowsTool(s, c)
	tools.RegisterListTestRowsTool(s, c)
	tools.RegisterUpdateTestRowTool(s, c)
	tools.RegisterDeleteTestRowTool(s, c)
	tools.RegisterProvideAccessTool(s, c)
	tools.RegisterListUsersWithAccessTool(s, c)
	tools.RegisterUpdateAccessTool(s, c)
	tools.RegisterRemoveAccessTool(s, c)
}
