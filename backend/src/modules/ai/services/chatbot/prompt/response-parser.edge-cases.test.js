/**
 * Branch coverage cho response-parser.js line 63:
 * `if (hasNumberMismatch) { return false; }` — FALSE branch
 * (hasNumberMismatch = false, fall through)
 */
process.env.NODE_ENV = 'test';

const { parseLLMOutput } = require('./response-parser');

describe('response-parser — hasNumberMismatch FALSE branch (line 63)', () => {
  // Cần test case: pName !== rName, có số ở cả hai, nhưng số GIỐNG NHAU
  // → hasNumberMismatch = false → if(false) không return → fall through

  test('Màn hình 27 inch vs Màn hình gaming 27: non-exact, cùng số 27, hasNumberMismatch=false', () => {
    // Dùng số STANDALONE (có space xung quanh) để \b\d+\b match được
    // pName='màn hình 27 inch', rName='màn hình gaming 27'
    // numbersP=['27'], numbersR=['27'] → hasNumberMismatch=false → FALSE branch
    const prods = [
      {
        id: 1,
        name: 'Màn hình 27 inch',
        price: 5000000,
        basePrice: 5000000,
        slug: 'man-hinh-27-inch',
        thumbnail: null,
        inStock: true,
        stockQuantity: 5,
      },
    ];
    const aiText = JSON.stringify({
      response: 'Màn hình gaming 27',
      matchedProducts: ['Màn hình gaming 27'],
      suggestions: [],
      intent: 'product_search',
    });
    // pName !== rName → không short-circuit ở line 45
    // numbersP=['27'], numbersR=['27'] → hasNumberMismatch = false
    // if (false) { return false; } → KHÔNG return → fall through → line 63 FALSE branch
    const result = parseLLMOutput(aiText, prods, 'màn hình 27');
    expect(result).toBeDefined();
  });

  test('Laptop 14 inch vs Laptop mỏng 14: non-exact, cùng số 14, hasNumberMismatch=false', () => {
    // '14' là standalone number (space xung quanh) trong cả 2 tên
    const prods = [
      {
        id: 2,
        name: 'Laptop 14 inch',
        price: 15000000,
        basePrice: 15000000,
        slug: 'laptop-14-inch',
        thumbnail: null,
        inStock: true,
        stockQuantity: 3,
      },
    ];
    const aiText = JSON.stringify({
      response: 'Laptop mỏng 14',
      matchedProducts: ['Laptop mỏng 14'],
      suggestions: [],
      intent: 'product_search',
    });
    // pName='laptop 14 inch', rName='laptop mỏng 14'
    // numbersP=['14'], numbersR=['14'] → no mismatch → if(false) → FALSE branch
    const result = parseLLMOutput(aiText, prods, 'laptop 14');
    expect(result).toBeDefined();
  });
});
