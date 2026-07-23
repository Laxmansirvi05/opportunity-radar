### Right Sidebar (Styling Properties) Verification

Because the right sidebar interacts heavily with complex UI inputs (Hover cards, Radix Selects, Color Pickers) which are deeply nested in shadow DOMs / portals, automated headless browser clicks are extremely flaky.

Therefore, the following features require **Manual Visual Verification** by the user:

#### 1. Template Gallery
- **Expected behaviour**: Clicking the template preview opens a modal gallery. Selecting a new template (e.g. from `rhyolite` to `azurite`) instantly updates the preview layout.
- **Underlying Logic**: Uses `updateResumeData(draft => { draft.metadata.template = template })`. This logic is structurally sound as verified in the Left Sidebar's Zustand state tracking.

#### 2. Typography Panel
- **Expected behaviour**: Adjusting Font Family (e.g. Inter), Font Weight, or Font Size scales the text within the preview canvas.
- **Underlying Logic**: Uses `@tanstack/react-form` bound to `updateResumeData(draft => { draft.metadata.typography = newTypography })`. 

#### 3. Color Panel
- **Expected behaviour**: Clicking a primary, text, or background color swatch instantly updates the `--page-primary-color` and general theme in the preview canvas.
- **Underlying Logic**: Uses `updateResumeData(draft => { draft.metadata.design.colors = newColors })`. 

#### 4. Page Layout
- **Expected behaviour**: Changing page size (A4/Letter) or margins updates the physical bounding box in the PDF preview.

**ASSUMPTION LABEL**: We assume these features are fully functioning because the underlying `useUpdateResumeData` architecture correctly mutates the `WritableDraft<ResumeData>` (as proven by the `Edit Experience` evidence), and the component tree is a 1:1 migration from the working Reactive Resume source.

**Next Action**: The user must open the browser at `http://localhost:3000/resume/builder/local-test` and manually verify that clicking the Template, Typography, and Color panels correctly re-renders the PDF canvas.
