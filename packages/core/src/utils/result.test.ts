import { describe, it, expect } from 'vitest';
import { OperationResult } from '../types';
import { queryOperation } from '../test-utils';
import { makeResult, mergeResultPatch } from './result';

describe('makeResult', () => {
  it('adds extensions and errors correctly', () => {
    const response = {};
    const origResult = {
      data: undefined,
      errors: ['error message'],
      extensions: {
        extensionKey: 'extensionValue',
      },
    };

    const result = makeResult(queryOperation, origResult, response);

    expect(result.operation).toBe(queryOperation);
    expect(result.data).toBe(undefined);
    expect(result.extensions).toEqual(origResult.extensions);
    expect(result.error).toMatchInlineSnapshot(
      `[CombinedError: [GraphQL] error message]`
    );
  });
});

describe('mergeResultPatch', () => {
  it('should ignore invalid patches', () => {
    const prevResult: OperationResult = {
      operation: queryOperation,
      data: {
        __typename: 'Query',
        items: [
          {
            __typename: 'Item',
            id: 'id',
          },
        ],
      },
    };

    const merged = mergeResultPatch(prevResult, {
      incremental: [
        {
          data: undefined,
          path: ['a'],
        },
        {
          items: null,
          path: ['b'],
        },
      ],
    });

    expect(merged.data).toStrictEqual({
      __typename: 'Query',
      items: [
        {
          __typename: 'Item',
          id: 'id',
        },
      ],
    });
  });

  it('should apply incremental defer patches', () => {
    const prevResult: OperationResult = {
      operation: queryOperation,
      data: {
        __typename: 'Query',
        items: [
          {
            __typename: 'Item',
            id: 'id',
            child: undefined,
          },
        ],
      },
    };

    const patch = { __typename: 'Child' };

    const merged = mergeResultPatch(prevResult, {
      incremental: [
        {
          data: patch,
          path: ['items', 0, 'child'],
        },
      ],
    });

    expect(merged.data.items[0]).not.toBe(prevResult.data.items[0]);
    expect(merged.data.items[0].child).toBe(patch);
    expect(merged.data).toStrictEqual({
      __typename: 'Query',
      items: [
        {
          __typename: 'Item',
          id: 'id',
          child: patch,
        },
      ],
    });
  });

  it('should handle null incremental defer patches', () => {
    const prevResult: OperationResult = {
      operation: queryOperation,
      data: {
        __typename: 'Query',
        item: undefined,
      },
    };

    const merged = mergeResultPatch(prevResult, {
      incremental: [
        {
          data: null,
          path: ['item'],
        },
      ],
    });

    expect(merged.data).not.toBe(prevResult.data);
    expect(merged.data.item).toBe(null);
  });

  it('should apply incremental stream patches', () => {
    const prevResult: OperationResult = {
      operation: queryOperation,
      data: {
        __typename: 'Query',
        items: [{ __typename: 'Item' }],
      },
    };

    const patch = { __typename: 'Item' };

    const merged = mergeResultPatch(prevResult, {
      incremental: [
        {
          items: [patch],
          path: ['items', 1],
        },
      ],
    });

    expect(merged.data.items).not.toBe(prevResult.data.items);
    expect(merged.data.items[0]).toBe(prevResult.data.items[0]);
    expect(merged.data.items[1]).toBe(patch);
    expect(merged.data).toStrictEqual({
      __typename: 'Query',
      items: [{ __typename: 'Item' }, { __typename: 'Item' }],
    });
  });

  it('should handle null incremental stream patches', () => {
    const prevResult: OperationResult = {
      operation: queryOperation,
      data: {
        __typename: 'Query',
        items: [{ __typename: 'Item' }],
      },
    };

    const merged = mergeResultPatch(prevResult, {
      incremental: [
        {
          items: null,
          path: ['items', 1],
        },
      ],
    });

    expect(merged.data.items).not.toBe(prevResult.data.items);
    expect(merged.data.items[0]).toBe(prevResult.data.items[0]);
    expect(merged.data).toStrictEqual({
      __typename: 'Query',
      items: [{ __typename: 'Item' }],
    });
  });

  it('should merge extensions from each patch', () => {
    const prevResult: OperationResult = {
      operation: queryOperation,
      data: {
        __typename: 'Query',
      },
      extensions: {
        base: true,
      },
    };

    const merged = mergeResultPatch(prevResult, {
      incremental: [
        {
          data: null,
          path: ['item'],
          extensions: {
            patch: true,
          },
        },
      ],
    });

    expect(merged.extensions).toStrictEqual({
      base: true,
      patch: true,
    });
  });

  it('should combine errors from each patch', () => {
    const prevResult: OperationResult = makeResult(queryOperation, {
      errors: ['base'],
    });

    const merged = mergeResultPatch(prevResult, {
      incremental: [
        {
          data: null,
          path: ['item'],
          errors: ['patch'],
        },
      ],
    });

    expect(merged.error).toMatchInlineSnapshot(`
      [CombinedError: [GraphQL] base
      [GraphQL] patch]
    `);
  });

  it('should preserve all data for noop patches', () => {
    const prevResult: OperationResult = {
      operation: queryOperation,
      data: {
        __typename: 'Query',
      },
      extensions: {
        base: true,
      },
    };

    const merged = mergeResultPatch(prevResult, {
      hasNext: false,
    });

    expect(merged.data).toStrictEqual({
      __typename: 'Query',
    });
  });

  it('handles the old version of the incremental payload spec (DEPRECATED)', () => {
    const prevResult: OperationResult = {
      operation: queryOperation,
      data: {
        __typename: 'Query',
        items: [
          {
            __typename: 'Item',
            id: 'id',
            child: undefined,
          },
        ],
      },
    };

    const patch = { __typename: 'Child' };

    const merged = mergeResultPatch(prevResult, {
      data: patch,
      path: ['items', 0, 'child'],
    } as any);

    expect(merged.data.items[0]).not.toBe(prevResult.data.items[0]);
    expect(merged.data.items[0].child).toBe(patch);
    expect(merged.data).toStrictEqual({
      __typename: 'Query',
      items: [
        {
          __typename: 'Item',
          id: 'id',
          child: patch,
        },
      ],
    });
  });
});
