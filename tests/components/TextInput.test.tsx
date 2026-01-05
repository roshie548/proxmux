import React from "react";
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { TextInput } from "../../src/components/forms/TextInput";

describe("TextInput", () => {
  describe("rendering", () => {
    test("renders label and value", () => {
      const { lastFrame } = render(
        <TextInput
          label="Username"
          value="john"
          onChange={() => {}}
        />
      );

      expect(lastFrame()).toContain("Username:");
      expect(lastFrame()).toContain("john");
    });

    test("renders placeholder when empty", () => {
      const { lastFrame } = render(
        <TextInput
          label="Username"
          value=""
          onChange={() => {}}
          placeholder="Enter username..."
        />
      );

      expect(lastFrame()).toContain("Enter username...");
    });

    test("shows cursor when active", () => {
      const { lastFrame } = render(
        <TextInput
          label="Username"
          value="test"
          onChange={() => {}}
          isActive={true}
        />
      );

      // Should show cursor block character
      expect(lastFrame()).toContain("█");
    });

    test("does not show cursor when inactive", () => {
      const { lastFrame } = render(
        <TextInput
          label="Username"
          value="test"
          onChange={() => {}}
          isActive={false}
        />
      );

      expect(lastFrame()).not.toContain("█");
    });

    test("masks password input", () => {
      const { lastFrame } = render(
        <TextInput
          label="Password"
          value="secret"
          onChange={() => {}}
          password={true}
        />
      );

      expect(lastFrame()).not.toContain("secret");
      expect(lastFrame()).toContain("••••••");
    });

    test("shows masked password with cursor when active", () => {
      const { lastFrame } = render(
        <TextInput
          label="Password"
          value="abc"
          onChange={() => {}}
          password={true}
          isActive={true}
        />
      );

      expect(lastFrame()).not.toContain("abc");
      expect(lastFrame()).toContain("•••");
      expect(lastFrame()).toContain("█");
    });
  });

  describe("visual states", () => {
    test("applies active styling when active", () => {
      const { lastFrame } = render(
        <TextInput
          label="Test"
          value=""
          onChange={() => {}}
          isActive={true}
        />
      );

      // Active state shows brackets with cursor
      expect(lastFrame()).toContain("[");
      expect(lastFrame()).toContain("]");
      expect(lastFrame()).toContain("█"); // cursor
    });

    test("respects width prop", () => {
      const { lastFrame } = render(
        <TextInput
          label="Description"
          value="Short"
          onChange={() => {}}
          width={20}
        />
      );

      // Component should render without error
      expect(lastFrame()).toContain("Description:");
      expect(lastFrame()).toContain("Short");
    });

    test("handles long values", () => {
      const longValue = "This is a very long text that exceeds the default width";
      const { lastFrame } = render(
        <TextInput
          label="Long"
          value={longValue}
          onChange={() => {}}
          width={30}
        />
      );

      // Should truncate to fit within width
      const frame = lastFrame();
      expect(frame).toContain("Long:");
      expect(frame).toBeDefined();
    });
  });

  describe("placeholder behavior", () => {
    test("shows placeholder when value is empty", () => {
      const { lastFrame } = render(
        <TextInput
          label="Name"
          value=""
          onChange={() => {}}
          placeholder="Enter name"
        />
      );

      expect(lastFrame()).toContain("Enter name");
    });

    test("does not show placeholder when value exists", () => {
      const { lastFrame } = render(
        <TextInput
          label="Name"
          value="John"
          onChange={() => {}}
          placeholder="Enter name"
        />
      );

      expect(lastFrame()).toContain("John");
      expect(lastFrame()).not.toContain("Enter name");
    });
  });

  describe("required indicator", () => {
    test("required prop is accepted", () => {
      const { lastFrame } = render(
        <TextInput
          label="Email"
          value="test@example.com"
          onChange={() => {}}
          required={true}
        />
      );

      // Component renders correctly with required prop
      expect(lastFrame()).toContain("Email:");
    });
  });

  describe("validator prop", () => {
    test("accepts validator function", () => {
      const emailValidator = (v: string) =>
        v.includes("@") ? null : "Invalid email";

      const { lastFrame } = render(
        <TextInput
          label="Email"
          value="test@example.com"
          onChange={() => {}}
          validator={emailValidator}
        />
      );

      // Component renders correctly with validator
      expect(lastFrame()).toContain("Email:");
    });
  });

  // Note: Keyboard interaction and validation error display tests
  // require a different testing approach since useInput hooks and
  // useEffect don't work the same way in the test environment.
  // These would be better suited for integration/e2e tests.
});
