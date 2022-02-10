import 'source-map-support/register';
import { DataShiftAnalyzer } from '../lib/data-shift/analyze';
import { loadDataSets } from '../lib/data-shift/loader';
import { DataShiftReporter } from '../lib/data-shift/reporter';
import { ConsoleLogger } from '../lib/log/console';

const console = new ConsoleLogger();

const dataSets = loadDataSets(console);

const analyzer = new DataShiftAnalyzer(undefined, console);
const results = analyzer.run(dataSets);

const reporter = new DataShiftReporter(console);
reporter.report(results);
