import * as luxon from 'luxon';
import { DataSetScheduler, parseSchedule } from "../lib/data/scheduler";
import { sorter } from '../lib/util/helpers';

const d1 = { timestamp: luxon.DateTime.fromISO('2020-05-17T09') };
const d2 = { timestamp: luxon.DateTime.fromISO('2020-05-18T09') };
const d3 = { timestamp: luxon.DateTime.fromISO('2020-05-19T09') };
const d4 = { timestamp: luxon.DateTime.fromISO('2020-05-20T09') };
const d5 = { timestamp: luxon.DateTime.fromISO('2020-05-21T09') };

const w1 = { timestamp: luxon.DateTime.fromISO('2020-04-29T10') };
const w2 = { timestamp: luxon.DateTime.fromISO('2020-05-06T10') };
const w3 = { timestamp: luxon.DateTime.fromISO('2020-05-13T10') };
const w4 = { timestamp: luxon.DateTime.fromISO('2020-05-20T08') };
const w5 = { timestamp: luxon.DateTime.fromISO('2020-05-27T10') };

const m1 = { timestamp: luxon.DateTime.fromISO('2020-02-20T11') };
const m2 = { timestamp: luxon.DateTime.fromISO('2020-03-20T11') };
const m3 = { timestamp: luxon.DateTime.fromISO('2020-04-20T11') };
const m4 = { timestamp: luxon.DateTime.fromISO('2020-05-20T07') };
const m5 = { timestamp: luxon.DateTime.fromISO('2020-06-20T11') };

describe(`Scheduler`, () => {

  it(`Can parse syntax`, () => {
    expect(parseSchedule(`8d 5w 2m`)).toEqual({
      day: 8,
      week: 5,
      month: 2,
    });

    expect(parseSchedule(`10w`)).toEqual({
      day: 0,
      week: 10,
      month: 0,
    });

    expect(parseSchedule(`  8d   5w   `)).toEqual({
      day: 8,
      week: 5,
      month: 0,
    });

    expect(parseSchedule(`    `)).toEqual({
      day: 0,
      week: 0,
      month: 0,
    });

    expect(parseSchedule(``)).toEqual({
      day: 0,
      week: 0,
      month: 0,
    });
  });

  it(`Can tell if timestamps are within schedule`, () => {
    const scheduler = new DataSetScheduler({
      day: 3,
      week: 0,
      month: 0,
    });

    expect(scheduler.check(d4.timestamp,
      [d1, d2, d3, d4, d5]
    )).toEqual(
      [d2, d3, d4]
    );
  });

  it(`Can work with weeks`, () => {
    const scheduler = new DataSetScheduler({
      day: 0,
      week: 3,
      month: 0,
    });

    expect(scheduler.check(w4.timestamp,
      [w1, w2, w3, w4, w5]
    )).toEqual(
      [w2, w3, w4]
    );
  });

  it(`Can work with months`, () => {
    const scheduler = new DataSetScheduler({
      day: 0,
      week: 0,
      month: 3,
    });

    expect(scheduler.check(m4.timestamp,
      [m1, m2, m3, m4, m5]
    )).toEqual(
      [m2, m3, m4]
    );
  });

  it(`Can work with combinations of units of time`, () => {
    const scheduler = new DataSetScheduler({
      day: 3,
      week: 3,
      month: 3,
    });

    expect(scheduler.check(d4.timestamp.plus({ hour: 2 }), [
      d1, d2, d3, d4, d5,
      w1, w2, w3, w4, w5,
      m1, m2, m3, m4, m5,
    ])).toEqual([
      d2, d3,
      w2, w3,
      m2, m3, m4, // m4 is earlier in the day than w4 and d4
    ].sort(sorter(o => o.timestamp.toMillis())));
  });

  it(`No schedule matches nothing`, () => {
    const scheduler = new DataSetScheduler({
      day: 0,
      week: 0,
      month: 0,
    });

    expect(scheduler.check(m4.timestamp, [
      d1, d2, d3, d4, d5,
      w1, w2, w3, w4, w5,
      m1, m2, m3, m4, m5,
    ])).toEqual([

    ]);
  });

  it(`Keeps only the first within a day`, () => {
    const scheduler = new DataSetScheduler({
      day: 3,
      week: 0,
      month: 0,
    });

    const from = d4.timestamp;

    const t1 = { timestamp: from.minus({ hours: 3 }) };
    const t2 = { timestamp: from.minus({ hours: 2 }) };
    const t3 = { timestamp: from.minus({ hours: 1 }) };
    const t4 = { timestamp: from };
    const t5 = { timestamp: from.plus({ hours: 1 }) };

    expect(scheduler.check(from,
      [t1, t2, t3, t4, t5]
    )).toEqual(
      [t1]
    );
  });

  it(`Takes all inputs into account within a limited schedule.`, () => {
    const scheduler = new DataSetScheduler({
      day: 0,
      week: 3,
      month: 0,
    });

    expect(scheduler.check(d4.timestamp.plus({ hour: 2 }), [
      d1, d2, d3, d4, d5,
      w1, w2, w3, w4, w5,
      m1, m2, m3, m4, m5,
    ])).toEqual([
      w2, w3, d2, // d2 is earlier in the same week as w4
    ].sort(sorter(o => o.timestamp.toMillis())));
  });

});
