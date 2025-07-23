# Documentation Setup

This directory contains the documentation for the Nanopore Tracking Application, configured for hosting on Read the Docs.

## Configuration Options

We provide two documentation configurations:

### 1. Sphinx Configuration (Default)
- **File**: `.readthedocs.yaml`
- **Features**: Full-featured documentation with API generation, PDF/ePub support
- **Requirements**: `docs/requirements.txt`
- **Config**: `docs/conf.py`

### 2. MkDocs Configuration (Simpler)
- **File**: `.readthedocs.yaml.simple` (rename to `.readthedocs.yaml` to use)
- **Features**: Material theme, easier Markdown handling
- **Requirements**: `docs/requirements-mkdocs.txt`
- **Config**: `mkdocs.yml`

## Local Development

### Using Sphinx
```bash
# Install dependencies
pip install -r docs/requirements.txt

# Build documentation
cd docs
sphinx-build -b html . _build/html

# View at: docs/_build/html/index.html
```

### Using MkDocs
```bash
# Install dependencies
pip install -r docs/requirements-mkdocs.txt

# Serve documentation locally
mkdocs serve

# Build documentation
mkdocs build
```

## Adding Documentation

1. Add new Markdown files to the `docs/` directory
2. Update the navigation in:
   - Sphinx: `docs/index.md` (toctree sections)
   - MkDocs: `mkdocs.yml` (nav section)

## Read the Docs Integration

1. Connect your GitHub repository to Read the Docs
2. The `.readthedocs.yaml` file will be automatically detected
3. Documentation will build on every push to the main branch

## Troubleshooting

- If builds fail, check the Read the Docs build logs
- Ensure all Python dependencies are in the requirements files
- For Sphinx issues, validate `conf.py` syntax
- For MkDocs issues, validate `mkdocs.yml` syntax 