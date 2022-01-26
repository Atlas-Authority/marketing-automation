# Deal Generator Test Engine

### Generate test cases

1. Run engine on real data: `npm run once -- [options]`

2. Look through `data/out/deal-generator.txt` for test cases.

3. Copy a License ID from an interesting group, e.g. `L2169473`.

4. Run `npm run generate-test L2169473`.

5. Copy the printed test-case into the test suite. Auto-format it. Give it a name. Tweak as needed.

6. To create tests with deals:
   1. Copy an existing test into a new one
   2. Copy its deals from its output to its input
   3. Redact any sensitive info (should be almost none)
   4. Run it and see what changes
   5. Put the new expected results into the test
   6. Make sure it makes sense
   7. Repeat until expected output is no-op
