# Contributing to IBM Cloud Cost Tracking System

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## 🤝 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of:

- Experience level
- Gender identity and expression
- Sexual orientation
- Disability
- Personal appearance
- Body size
- Race
- Ethnicity
- Age
- Religion
- Nationality

### Expected Behavior

- Be respectful and considerate
- Use welcoming and inclusive language
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior

- Harassment, trolling, or discriminatory comments
- Personal or political attacks
- Publishing others' private information
- Any conduct that could be considered inappropriate in a professional setting

## 🚀 Getting Started

### Prerequisites

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/ibmcloud-cost-tracking.git
   cd ibmcloud-cost-tracking
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/original-org/ibmcloud-cost-tracking.git
   ```
4. **Install dependencies**:
   ```bash
   pnpm install
   ```
5. **Set up environment variables**:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

### Development Setup

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Start development servers**:
   ```bash
   pnpm dev
   ```

3. **Make your changes** and test thoroughly

4. **Run tests**:
   ```bash
   pnpm test
   ```

5. **Lint your code**:
   ```bash
   pnpm lint:fix
   ```

## 🔄 Development Workflow

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/add-export-pdf`)
- `fix/` - Bug fixes (e.g., `fix/cache-invalidation`)
- `docs/` - Documentation updates (e.g., `docs/update-readme`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-auth`)
- `test/` - Test additions or updates (e.g., `test/add-unit-tests`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

### Keeping Your Fork Updated

```bash
# Fetch upstream changes
git fetch upstream

# Merge upstream changes into your main branch
git checkout main
git merge upstream/main

# Push updates to your fork
git push origin main
```

## 📝 Coding Standards

### TypeScript

- **Use TypeScript** for all new code
- **Enable strict mode** - all code must pass strict TypeScript checks
- **Avoid `any`** - use proper types or `unknown` with type guards
- **Use interfaces** for object shapes, types for unions/intersections
- **Document complex types** with JSDoc comments

### Code Style

We use **ESLint** and **Prettier** for consistent code formatting:

```bash
# Format code
pnpm format

# Lint and fix
pnpm lint:fix
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `resource-collector.service.ts`)
- **Classes**: `PascalCase` (e.g., `ResourceCollector`)
- **Functions/Variables**: `camelCase` (e.g., `fetchResources`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)
- **Interfaces**: `PascalCase` with `I` prefix optional (e.g., `Resource` or `IResource`)
- **Types**: `PascalCase` (e.g., `UsageData`)

### File Organization

```typescript
// 1. Imports (grouped and sorted)
import { external } from 'external-package';
import { internal } from '@/internal-module';

// 2. Types and Interfaces
interface MyInterface {
  // ...
}

// 3. Constants
const MY_CONSTANT = 'value';

// 4. Main code
export class MyClass {
  // ...
}

// 5. Helper functions (if any)
function helperFunction() {
  // ...
}
```

### Backend Standards

- **Services**: Business logic in service classes
- **Controllers**: Thin controllers, delegate to services
- **Error Handling**: Use custom error classes, proper HTTP status codes
- **Logging**: Use Pino logger, structured logging
- **Async/Await**: Prefer async/await over callbacks
- **Validation**: Use Zod for input validation

### Frontend Standards

- **Components**: Functional components with hooks
- **Props**: Define prop types with TypeScript interfaces
- **State Management**: Use Zustand for global state
- **Styling**: Use Tailwind CSS utility classes
- **Accessibility**: Follow WCAG 2.1 AA standards
- **Performance**: Use React.memo, useMemo, useCallback appropriately

## 📝 Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples

```bash
feat(backend): add PDF export functionality

Implement PDF generation for cost reports using jsPDF.
Includes chart rendering and data tables.

Closes #123
```

```bash
fix(frontend): resolve chart rendering issue on mobile

Charts were not responsive on small screens.
Updated Recharts configuration to use responsive container.

Fixes #456
```

### Commit Best Practices

- **Keep commits atomic** - one logical change per commit
- **Write clear messages** - explain what and why, not how
- **Reference issues** - use `Closes #123` or `Fixes #456`
- **Sign commits** - use `git commit -s` for DCO

## 🔍 Pull Request Process

### Before Submitting

1. ✅ **Update your branch** with latest upstream changes
2. ✅ **Run all tests** and ensure they pass
3. ✅ **Run linting** and fix any issues
4. ✅ **Update documentation** if needed
5. ✅ **Add tests** for new features
6. ✅ **Test manually** in development environment

### PR Title Format

Use the same format as commit messages:

```
feat(backend): add Redis caching support
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally

## Related Issues
Closes #123
```

### Review Process

1. **Automated checks** must pass (CI/CD, linting, tests)
2. **At least one approval** required from maintainers
3. **Address feedback** - respond to all review comments
4. **Keep PR updated** - rebase if needed
5. **Squash commits** - maintainers will squash before merging

## 🧪 Testing Guidelines

### Test Coverage

- **Minimum 80% coverage** for new code
- **Unit tests** for all services and utilities
- **Integration tests** for API endpoints
- **E2E tests** for critical user flows

### Writing Tests

```typescript
// Good test structure
describe('ResourceCollector', () => {
  describe('fetchResources', () => {
    it('should fetch all resources successfully', async () => {
      // Arrange
      const collector = new ResourceCollector(mockClient);
      
      // Act
      const resources = await collector.fetchResources();
      
      // Assert
      expect(resources).toHaveLength(10);
      expect(resources[0]).toHaveProperty('id');
    });

    it('should handle API errors gracefully', async () => {
      // Test error handling
    });
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test path/to/test.spec.ts

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test -- --watch
```

## 📚 Documentation

### Code Documentation

- **JSDoc comments** for public APIs
- **Inline comments** for complex logic
- **README files** in major directories
- **Type definitions** with descriptions

### Example

```typescript
/**
 * Fetches resources from IBM Cloud Resource Controller API
 * 
 * @param accountId - IBM Cloud account ID
 * @param options - Optional filtering and pagination options
 * @returns Promise resolving to array of resources
 * @throws {AuthenticationError} If API key is invalid
 * @throws {RateLimitError} If rate limit is exceeded
 * 
 * @example
 * ```typescript
 * const resources = await fetchResources('account-123', {
 *   resourceGroup: 'default',
 *   limit: 100
 * });
 * ```
 */
export async function fetchResources(
  accountId: string,
  options?: FetchOptions
): Promise<Resource[]> {
  // Implementation
}
```

### Updating Documentation

- Update README.md for user-facing changes
- Update TECHNICAL_SPEC.md for architecture changes
- Add inline documentation for complex code
- Update API documentation for endpoint changes

## 🐛 Reporting Bugs

### Before Reporting

1. **Search existing issues** - your bug may already be reported
2. **Test with latest version** - bug may be fixed
3. **Reproduce consistently** - provide clear steps

### Bug Report Template

```markdown
**Describe the bug**
Clear description of the bug

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What should happen

**Screenshots**
If applicable

**Environment**
- OS: [e.g., macOS 13.0]
- Node.js: [e.g., 18.17.0]
- Browser: [e.g., Chrome 120]

**Additional context**
Any other relevant information
```

## 💡 Suggesting Features

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem

**Describe the solution you'd like**
Clear description of desired functionality

**Describe alternatives you've considered**
Other approaches you've thought about

**Additional context**
Mockups, examples, or other details
```

## 📞 Getting Help

- **GitHub Discussions** - For questions and discussions
- **GitHub Issues** - For bugs and feature requests
- **Email** - support@example.com for private inquiries

## 🎉 Recognition

Contributors will be recognized in:

- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing to IBM Cloud Cost Tracking System! 🚀