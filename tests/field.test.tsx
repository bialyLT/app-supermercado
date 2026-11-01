import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Field } from "../components/field";

describe("Field", () => {
  it("associates labels, help, and errors with the control", () => {
    const markup = renderToStaticMarkup(
      <Field id="email" label="Correo" required helpText="Usá el correo operativo" error="El correo es obligatorio">
        <input type="email" />
      </Field>,
    );

    expect(markup).toContain('for="email"');
    expect(markup).toContain('id="email"');
    expect(markup).toContain('aria-required="true"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="email-help email-error"');
    expect(markup).toContain('id="email-help"');
    expect(markup).toContain('id="email-error"');
  });

  it("does not mark a valid optional control as invalid", () => {
    const markup = renderToStaticMarkup(
      <Field id="branch" label="Sucursal">
        <select><option value="">Todas</option></select>
      </Field>,
    );

    expect(markup).toContain('aria-invalid="false"');
    expect(markup).not.toContain("aria-required");
    expect(markup).not.toContain("aria-describedby");
  });
});
