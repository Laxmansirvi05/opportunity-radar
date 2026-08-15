// Registers @testing-library/jest-dom's matchers (toBeInTheDocument, etc.)
// against Vitest's `expect` — without this, every component test using them
// fails with "Invalid Chai property" regardless of whether the component
// itself renders correctly. Part of CODE-02 (6 component tests were never
// actually running at all: missing dependency, un-collected by the test
// glob, and missing this registration, three separate gaps stacked).
import '@testing-library/jest-dom/vitest'
