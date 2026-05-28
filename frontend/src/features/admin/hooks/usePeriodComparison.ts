/**
 * @file usePeriodComparison.ts
 * @layer Hook
 * @feature admin
 * @description Hook so sánh dữ liệu dashboard giữa 2 kỳ (spec §21.5 Signature Feature)
 */
import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useGetDetailedStatsQuery } from '../api/admin-dashboard-api';

export type ComparePeriod = 'previous-week' | 'previous-month' | 'previous-year' | null;

interface DateRange {
  startDate: string;
  endDate: string;
  groupBy: 'day' | 'week' | 'month';
}

function calculatePreviousRange(current: DateRange, compareTo: ComparePeriod): DateRange | null {
  if (!compareTo) return null;
  const start = dayjs(current.startDate);
  const end = dayjs(current.endDate);

  switch (compareTo) {
    case 'previous-week':
      return {
        startDate: start.subtract(7, 'day').format('YYYY-MM-DD'),
        endDate: end.subtract(7, 'day').format('YYYY-MM-DD'),
        groupBy: 'day',
      };
    case 'previous-month':
      return {
        startDate: start.subtract(1, 'month').format('YYYY-MM-DD'),
        endDate: end.subtract(1, 'month').format('YYYY-MM-DD'),
        groupBy: 'day',
      };
    case 'previous-year':
      return {
        startDate: start.subtract(1, 'year').format('YYYY-MM-DD'),
        endDate: end.subtract(1, 'year').format('YYYY-MM-DD'),
        groupBy: 'month',
      };
    default:
      return null;
  }
}

export function usePeriodComparison(current: DateRange, compareTo: ComparePeriod) {
  const previousRange = useMemo(
    () => calculatePreviousRange(current, compareTo),
    [current, compareTo],
  );

  const currentQuery = useGetDetailedStatsQuery(current);

  const previousQuery = useGetDetailedStatsQuery(
    previousRange ?? { startDate: '', endDate: '', groupBy: 'day' },
    { enabled: !!previousRange, skip: !previousRange },
  );

  const currentOrders = useMemo(
    () => currentQuery.data?.data?.orders ?? [],
    [currentQuery.data?.data?.orders],
  );
  const previousOrders = useMemo(
    () => previousQuery.data?.data?.orders ?? [],
    [previousQuery.data?.data?.orders],
  );

  const currentTotals = useMemo(
    () => ({
      orderCount: currentOrders.reduce((sum, o) => sum + o.orderCount, 0),
      revenue: currentOrders.reduce((sum, o) => sum + o.revenue, 0),
    }),
    [currentOrders],
  );

  const previousTotals = useMemo(
    () => ({
      orderCount: previousOrders.reduce((sum, o) => sum + o.orderCount, 0),
      revenue: previousOrders.reduce((sum, o) => sum + o.revenue, 0),
    }),
    [previousOrders],
  );

  // Tính delta %
  const delta = useMemo(() => {
    const calcDelta = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    return {
      orderCount: calcDelta(currentTotals.orderCount, previousTotals.orderCount),
      revenue: calcDelta(currentTotals.revenue, previousTotals.revenue),
    };
  }, [currentTotals, previousTotals]);

  return {
    isComparing: !!compareTo,
    isLoading: currentQuery.isLoading || (!!compareTo && previousQuery.isLoading),
    currentOrders,
    previousOrders,
    currentTotals,
    previousTotals,
    delta,
    previousRange,
  };
}
