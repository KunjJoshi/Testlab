package tools

import (
	"context"
	"fmt"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func RegisterGetSuiteByIDTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("get-suite-by-id",
		mcp.WithDescription("Fetch a single test suite by its ID"),
		mcp.WithNumber("suite_id", mcp.Required(), mcp.Description("The suite's ID")),
	)

	handler := newGetSuiteByIDHandler(c)
	s.AddTool(tool, handler.Handle)
}

type getSuiteByIDHandler struct {
	client *client.Client
}

func newGetSuiteByIDHandler(c *client.Client) *getSuiteByIDHandler {
	return &getSuiteByIDHandler{client: c}
}

func (h *getSuiteByIDHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {

	suiteID, err := req.RequireInt("suite_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	resp, err := h.client.Get(fmt.Sprintf("/suites/%d", suiteID))
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}

func RegisterListAllSuitesTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("list-all-suites",
		mcp.WithDescription("List all test suites owned by or shared with the current user"),
	)

	handler := newListAllSuitesHandler(c)
	s.AddTool(tool, handler.Handle)
}

type listAllSuitesHandler struct {
	client *client.Client
}

func newListAllSuitesHandler(c *client.Client) *listAllSuitesHandler {
	return &listAllSuitesHandler{client: c}
}

func (h *listAllSuitesHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	resp, err := h.client.Get("/suites")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}
