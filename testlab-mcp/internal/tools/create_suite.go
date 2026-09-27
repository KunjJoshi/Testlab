package tools

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
)

func RegisterCreateSuiteTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("create-test-suite",
		mcp.WithDescription("Create a new E2E test suite for a set of changes"),
		mcp.WithString("suite_name", mcp.Required(), mcp.Description("Short name for the suite")),
		mcp.WithString("suite_description", mcp.Description("What this suite covers")),
	)

	handler := newCreateSuiteHandler(c)
	s.AddTool(tool, handler.Handle)
}

type createSuiteHandler struct {
	client *client.Client
}

func newCreateSuiteHandler(c *client.Client) *createSuiteHandler {
	return &createSuiteHandler{client: c}
}

func (h *createSuiteHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	name, err := req.RequireString("suite_name")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	desc := req.GetString("suite_description", "")
	resp, err := h.client.Post("/suites", map[string]any{
		"suite_name":        name,
		"suite_description": desc,
	})
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}
