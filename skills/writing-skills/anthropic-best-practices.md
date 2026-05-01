# Skill authoring best practices

> Learn how to write effective Skills that agents can discover and use successfully.

Good Skills are concise, well-structured, and tested with real usage. This guide provides practical authoring decisions to help you write Skills that agents can discover and use effectively.

## Core principles

### Concise is key

The context window is a public good. Your Skill shares the context window with everything else the agent needs to know, including:

* The system prompt
* Conversation history
* Other Skills' metadata
* Your actual request

Not every token in your Skill has an immediate cost. At startup, only the metadata (name and description) from all Skills is pre-loaded. The agent reads SKILL.md only when the Skill becomes relevant, and reads additional files only as needed. However, being concise in SKILL.md still matters: once loaded, every token competes with conversation history and other context.

**Default assumption**: The agent is already very smart

Only add context it doesn't already have. Challenge each piece of information:

* "Does the agent really need this explanation?"
* "Can I assume the agent knows this?"
* "Does this paragraph justify its token cost?"

**Good example: Concise** (approximately 50 tokens):

````markdown
## Extract PDF text

Use pdfplumber for text extraction:

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
````

**Bad example: Too verbose** (approximately 150 tokens):

```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available for PDF processing, but we
recommend pdfplumber because it's easy to use and handles most cases well.
First, you'll need to install it using pip. Then you can use the code below...
```

The concise version assumes the agent knows what PDFs are and how libraries work.

### Set appropriate degrees of freedom

Match the level of specificity to the task's fragility and variability.

**High freedom** (text-based instructions):

Use when:
* Multiple approaches are valid
* Decisions depend on context
* Heuristics guide the approach

**Medium freedom** (pseudocode or scripts with parameters):

Use when:
* A preferred pattern exists
* Some variation is acceptable
* Configuration affects behavior

**Low freedom** (specific scripts, few or no parameters):

Use when:
* Operations are fragile and error-prone
* Consistency is critical
* A specific sequence must be followed

**Analogy**: Think of the agent as a robot exploring a path:
* **Narrow bridge with cliffs**: One safe way forward. Provide specific guardrails (low freedom).
* **Open field**: Many paths lead to success. Give general direction (high freedom).

### Test with all models you plan to use

Skills act as additions to models, so effectiveness depends on the underlying model. Test your Skill with all the models you plan to use it with.

What works perfectly for a powerful reasoning model might need more detail for a faster, more economical one. If you plan to use your Skill across multiple models, aim for instructions that work well with all of them.

## Skill structure

### Naming conventions

Use consistent naming patterns. We recommend **gerund form** (verb + -ing) for Skill names, as this clearly describes the activity or capability.

**Good naming examples (gerund form)**:
* "processing-pdfs"
* "analyzing-spreadsheets"
* "managing-databases"
* "testing-code"
* "writing-documentation"

**Avoid**:
* Vague names: "helper", "utils", "tools"
* Overly generic: "documents", "data", "files"

### Writing effective descriptions

The `description` field enables Skill discovery and should include both what the Skill does and when to use it.

**Always write in third person.** The description is injected into the system prompt.

* **Good:** "Processes Excel files and generates reports"
* **Avoid:** "I can help you process Excel files"
* **Avoid:** "You can use this to process Excel files"

**Be specific and include key terms**. Each Skill has exactly one description field. The description is critical for skill selection: the agent uses it to choose the right Skill from potentially many available Skills.

### Progressive disclosure patterns

SKILL.md serves as an overview that points to detailed materials as needed, like a table of contents.

**Practical guidance:**
* Keep SKILL.md body under 500 lines for optimal performance
* Split content into separate files when approaching this limit
* Use references to organize instructions, code, and resources effectively

#### Pattern 1: High-level guide with references

````markdown
---
name: PDF Processing
description: Extracts text and tables from PDF files, fills forms, and merges documents. Use when working with PDF files.
---

# PDF Processing

## Quick start

Extract text with pdfplumber:
```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## Advanced features

**Form filling**: See [FORMS.md](FORMS.md) for complete guide
**API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
**Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
````

The agent loads referenced files only when needed.

#### Pattern 2: Domain-specific organization

For Skills with multiple domains, organize content by domain to avoid loading irrelevant context.

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

#### Pattern 3: Conditional details

Show basic content, link to advanced content:

```markdown
# DOCX Processing

## Creating documents
Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents
For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

### Avoid deeply nested references

Keep references one level deep from SKILL.md. All reference files should link directly from SKILL.md to ensure complete files are read when needed.

**Bad: Too deep**:
```
SKILL.md → advanced.md → details.md → actual information
```

**Good: One level deep**:
```
SKILL.md → advanced.md
SKILL.md → reference.md
SKILL.md → examples.md
```

### Structure longer reference files with table of contents

For reference files longer than 100 lines, include a table of contents at the top. This ensures the full scope is visible even when previewing with partial reads.

## Workflows and feedback loops

### Use workflows for complex tasks

Break complex operations into clear, sequential steps. For complex workflows, provide a checklist that can be tracked with the `plan_tracker` tool.

### Implement feedback loops

**Common pattern**: Run validator → fix errors → repeat

This pattern greatly improves output quality.

```markdown
## Document editing process

1. Make your edits to `word/document.xml`
2. **Validate immediately**: `python ooxml/scripts/validate.py unpacked_dir/`
3. If validation fails:
   - Review the error message carefully
   - Fix the issues in the XML
   - Run validation again
4. **Only proceed when validation passes**
5. Rebuild: `python ooxml/scripts/pack.py unpacked_dir/ output.docx`
6. Test the output document
```

## Content guidelines

### Avoid time-sensitive information

Don't include information that will become outdated. Use "old patterns" sections with details blocks for historical context.

### Use consistent terminology

Choose one term and use it throughout the Skill:
* **Good**: Always "API endpoint", always "field", always "extract"
* **Bad**: Mix "API endpoint"/"URL"/"API route"/"path"

## Common patterns

### Template pattern

Provide templates for output format. Match the level of strictness to your needs.

### Examples pattern

For Skills where output quality depends on seeing examples, provide input/output pairs.

### Conditional workflow pattern

Guide through decision points:

```markdown
## Document modification workflow

1. Determine the modification type:

   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below
```

## Anti-patterns to avoid

### Avoid Windows-style paths

Always use forward slashes in file paths:
* ✓ **Good**: `scripts/helper.py`, `reference/guide.md`
* ✗ **Avoid**: `scripts\helper.py`, `reference\guide.md`

### Avoid offering too many options

Don't present multiple approaches unless necessary:

````markdown
**Bad: Too many choices** (confusing):
"You can use pypdf, or pdfplumber, or PyMuPDF, or pdf2image, or..."

**Good: Provide a default** (with escape hatch):
"Use pdfplumber for text extraction:
```python
import pdfplumber
```
For scanned PDFs requiring OCR, use pdf2image with pytesseract instead."
````

## Evaluation and iteration

### Build evaluations first

**Create evaluations BEFORE writing extensive documentation.** This ensures your Skill solves real problems rather than documenting imagined ones.

**Evaluation-driven development:**
1. **Identify gaps**: Run agents on representative tasks without a Skill. Document specific failures
2. **Create evaluations**: Build three scenarios that test these gaps
3. **Establish baseline**: Measure performance without the Skill
4. **Write minimal instructions**: Create just enough content to address the gaps
5. **Iterate**: Execute evaluations, compare against baseline, refine

### Develop Skills iteratively with agents

The most effective process involves agents themselves. Work with one instance ("Agent A") to create a Skill that will be used by other instances ("Agent B"). Agent A helps design and refine instructions, while Agent B tests them in real tasks.

**Iterating on existing Skills:**
1. **Use the Skill in real workflows**: Give Agent B actual tasks
2. **Observe behavior**: Note struggles, successes, unexpected choices
3. **Return to Agent A for improvements**: Share current SKILL.md and observations
4. **Apply and test changes**: Update the Skill, test again
5. **Repeat based on usage**: Continue observe-refine-test cycle

## Checklist for effective Skills

### Core quality
* [ ] Description is specific and includes key terms
* [ ] Description includes both what the Skill does and when to use it
* [ ] SKILL.md body is under 500 lines
* [ ] Additional details are in separate files (if needed)
* [ ] No time-sensitive information
* [ ] Consistent terminology throughout
* [ ] Examples are concrete, not abstract
* [ ] File references are one level deep
* [ ] Progressive disclosure used appropriately
* [ ] Workflows have clear steps

### Code and scripts
* [ ] Scripts solve problems rather than punt to agent
* [ ] Error handling is explicit and helpful
* [ ] No "voodoo constants" (all values justified)
* [ ] Required packages listed in instructions
* [ ] No Windows-style paths (all forward slashes)
* [ ] Validation/verification steps for critical operations
* [ ] Feedback loops included for quality-critical tasks

### Testing
* [ ] At least three evaluations created
* [ ] Tested with real usage scenarios
* [ ] Team feedback incorporated (if applicable)
