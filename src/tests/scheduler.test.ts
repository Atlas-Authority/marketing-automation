import { parseSchedule } from "../lib/data/scheduler";

describe(`Scheduler syntax`, () => {

  it(`Creates a schedule object`, () => {
    expect(parseSchedule(`8d 5w 2m`)).toEqual({
      days: 8,
      weeks: 5,
      months: 2,
    });

    expect(parseSchedule(`10w`)).toEqual({
      days: 0,
      weeks: 10,
      months: 0,
    });

    expect(parseSchedule(``)).toEqual({
      days: 0,
      weeks: 0,
      months: 0,
    });
  });

});
