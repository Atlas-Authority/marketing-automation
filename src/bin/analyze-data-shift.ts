import 'source-map-support/register';
import { DataShiftAnalyzer } from '../lib/data-shift/analyze';
import { dataManager } from '../lib/data/manager';

const analyzer = new DataShiftAnalyzer();
analyzer.run(dataManager.allDataSets());
