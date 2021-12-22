# Deal Generator Test Engine

### Generate test cases

1. Run engine on real data: `npm run once -- [options]`

2. Look through `data/out/deal-generator.txt` for test cases.

3. Copy the ID of an interesting one. It'll be in base64 form just above the Records table, e.g. `W1siMjUwODg4NSIsW11dXQ==`.

4. Run `npm run generate-test -- W1siMjQ1NDgyMiIsW11dXQ==`.

5. Copy the printed test-case into the test suite. Auto-format it. Give it a name. Tweak as needed.

6. To create tests with deals:
   1. Copy an existing test into a new one
   2. Copy its deals from its output to its input
   3. Run it and see what changes
   4. Put the new expected results into the test
   5. Make sure it makes sense
   6. Repeat until expected output is no-op
