with open("components/gameLogic.js", "r") as f:
    content = f.read()

old = "    ) && Math.abs(wordLower.length - bwLower.length) <= 3;\n  });\n\n  return hasBonusMatch ? HIDDEN_WORD_BONUS : 0;\n}"

new = """    // Require the shorter word to be at least 70% of the longer word
    const shorter = Math.min(wordLower.length, bwLower.length);
    const longer = Math.max(wordLower.length, bwLower.length);
    const matchRatio = shorter / longer;

    return matchRatio >= 0.7;
  });

  return hasBonusMatch ? HIDDEN_WORD_BONUS : 0;
}"""

content = content.replace(old, new)

with open("components/gameLogic.js", "w") as f:
    f.write(content)

print("Done! Replacement successful.")
```

```tool
TOOL_NAME: run_terminal_command
BEGIN_ARG: command
"python3 /tmp/fix_bonus.py"