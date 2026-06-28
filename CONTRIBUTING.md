1. Install NodeJS.

1. Open a terminal in the project's root.
2. Run ```npm install husky lint-staged --save-dev```.
3. Configure the generated package.json by adding this snippet:
{
  "lint-staged": {
    "*.js": [
      "clang-format -i"
    ]
  }
}
4. Run ```echo "npx lint-staged" > .husky/pre-commit```
5. If on Linux/macOS, ensure git has permission to run the hook:
```chmod +x .husky/pre-commit``` 
6. Add this line of code to the top of the generated pre-commit file:
```#!/bin/sh```
7. Ensure the pre-commit file is saved with utf-8 encoding.
