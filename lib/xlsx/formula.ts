const OPERATOR_PRECEDENCE: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
};

function isOperator(token: string) {
  return token in OPERATOR_PRECEDENCE;
}

function tokenize(formula: string) {
  const tokens: string[] = [];
  let index = 0;

  while (index < formula.length) {
    const char = formula[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[+\-*/()]/.test(char)) {
      tokens.push(char);
      index += 1;
      continue;
    }

    if (/\d/.test(char) || char === ".") {
      let numberToken = char;
      index += 1;
      while (index < formula.length && /[\d.]/.test(formula[index])) {
        numberToken += formula[index];
        index += 1;
      }
      tokens.push(numberToken);
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let identifierToken = char;
      index += 1;
      while (index < formula.length && /[A-Za-z0-9_]/.test(formula[index])) {
        identifierToken += formula[index];
        index += 1;
      }
      tokens.push(identifierToken);
      continue;
    }

    throw new Error(`Token invalido na formula: "${char}"`);
  }

  return tokens;
}

function toRpn(tokens: string[]) {
  const output: string[] = [];
  const operators: string[] = [];

  for (const token of tokens) {
    if (/^\d+(\.\d+)?$/.test(token) || /^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
      output.push(token);
      continue;
    }

    if (isOperator(token)) {
      while (
        operators.length > 0 &&
        isOperator(operators[operators.length - 1]) &&
        OPERATOR_PRECEDENCE[operators[operators.length - 1]] >= OPERATOR_PRECEDENCE[token]
      ) {
        output.push(operators.pop() as string);
      }
      operators.push(token);
      continue;
    }

    if (token === "(") {
      operators.push(token);
      continue;
    }

    if (token === ")") {
      while (operators.length > 0 && operators[operators.length - 1] !== "(") {
        output.push(operators.pop() as string);
      }

      if (operators.pop() !== "(") {
        throw new Error("Formula com parenteses invalidos.");
      }
      continue;
    }

    throw new Error(`Token nao suportado na formula: "${token}"`);
  }

  while (operators.length > 0) {
    const operator = operators.pop() as string;
    if (operator === "(" || operator === ")") {
      throw new Error("Formula com parenteses invalidos.");
    }
    output.push(operator);
  }

  return output;
}

export function evaluateFormula(formula: string, context: Record<string, number>) {
  const tokens = tokenize(formula);
  const rpn = toRpn(tokens);
  const stack: number[] = [];

  for (const token of rpn) {
    if (/^\d+(\.\d+)?$/.test(token)) {
      stack.push(Number(token));
      continue;
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
      stack.push(context[token] ?? 0);
      continue;
    }

    if (isOperator(token)) {
      const right = stack.pop();
      const left = stack.pop();

      if (left === undefined || right === undefined) {
        throw new Error("Formula invalida.");
      }

      switch (token) {
        case "+":
          stack.push(left + right);
          break;
        case "-":
          stack.push(left - right);
          break;
        case "*":
          stack.push(left * right);
          break;
        case "/":
          stack.push(right === 0 ? 0 : left / right);
          break;
        default:
          throw new Error("Operador invalido.");
      }
      continue;
    }

    throw new Error("Formula invalida.");
  }

  if (stack.length !== 1 || !Number.isFinite(stack[0])) {
    throw new Error("Formula invalida.");
  }

  return Number(stack[0].toFixed(2));
}
