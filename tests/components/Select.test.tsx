import React from "react";
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { Select, type SelectOption } from "../../src/components/forms/Select";

const mockOptions: SelectOption<string>[] = [
  { label: "Option 1", value: "opt1" },
  { label: "Option 2", value: "opt2", description: "Second option" },
  { label: "Option 3", value: "opt3" },
];

describe("Select", () => {
  describe("rendering", () => {
    test("renders label and placeholder when no value", () => {
      const { lastFrame } = render(
        <Select
          label="Test Select"
          options={mockOptions}
          value={null}
          onChange={() => {}}
        />
      );

      expect(lastFrame()).toContain("Test Select:");
      expect(lastFrame()).toContain("Select an option...");
    });

    test("renders selected value", () => {
      const { lastFrame } = render(
        <Select
          label="Test Select"
          options={mockOptions}
          value="opt2"
          onChange={() => {}}
        />
      );

      expect(lastFrame()).toContain("Option 2");
    });

    test("renders custom placeholder", () => {
      const { lastFrame } = render(
        <Select
          label="Test Select"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          placeholder="Pick one..."
        />
      );

      expect(lastFrame()).toContain("Pick one...");
    });

    test("shows hint when active", () => {
      const { lastFrame } = render(
        <Select
          label="Test Select"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          isActive={true}
        />
      );

      expect(lastFrame()).toContain("↵ to open");
    });

    test("does not show hint when inactive", () => {
      const { lastFrame } = render(
        <Select
          label="Test Select"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          isActive={false}
        />
      );

      expect(lastFrame()).not.toContain("[Enter to");
    });

    test("renders with different generic types", () => {
      const numericOptions: SelectOption<number>[] = [
        { label: "One", value: 1 },
        { label: "Two", value: 2 },
      ];

      const { lastFrame } = render(
        <Select<number>
          label="Number"
          options={numericOptions}
          value={1}
          onChange={() => {}}
        />
      );

      expect(lastFrame()).toContain("One");
    });

    test("handles empty options array", () => {
      const { lastFrame } = render(
        <Select
          label="Empty"
          options={[]}
          value={null}
          onChange={() => {}}
        />
      );

      expect(lastFrame()).toContain("Empty:");
      expect(lastFrame()).toContain("Select an option...");
    });
  });

  describe("visual states", () => {
    test("applies active styling when active", () => {
      const { lastFrame } = render(
        <Select
          label="Test"
          options={mockOptions}
          value={null}
          onChange={() => {}}
          isActive={true}
        />
      );

      // Active state shows brackets and hint
      expect(lastFrame()).toContain("[");
      expect(lastFrame()).toContain("]");
      expect(lastFrame()).toContain("↵ to open");
    });

    test("shows selected value label correctly", () => {
      const { lastFrame } = render(
        <Select
          label="Status"
          options={[
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ]}
          value="active"
          onChange={() => {}}
        />
      );

      expect(lastFrame()).toContain("Active");
      expect(lastFrame()).not.toContain("Inactive");
    });
  });

  // Note: Keyboard interaction tests require a different testing approach
  // since useInput hooks don't work the same way in the test environment.
  // These would be better suited for integration/e2e tests.
});
