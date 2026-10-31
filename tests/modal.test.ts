import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Modal } from "../components/modal";

describe("Modal", () => {
  it("renders an accessible modal dialog with a labelled title", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        Modal,
        {
          ariaLabelledBy: "dialog-title",
          onRequestClose: () => undefined,
          children: React.createElement(
            React.Fragment,
            null,
            React.createElement("h2", { id: "dialog-title" }, "Keyboard help"),
            React.createElement("button", { type: "button" }, "Close")
          ),
        }
      )
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="dialog-title"');
    expect(markup).toContain("Keyboard help");
  });
});
