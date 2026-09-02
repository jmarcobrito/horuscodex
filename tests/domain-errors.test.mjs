import assert from "node:assert/strict";
import test from "node:test";

import { domainError, domainErrorResponse } from "../db/domain-errors.ts";

test("translates an outdated review into a stable retry action", () => {
  assert.deepEqual(domainErrorResponse(domainError("REVIEW_OUTDATED")), {
    status: 409,
    body: {
      error: {
        code: "REVIEW_OUTDATED",
        message: "Os dados deste mês mudaram. Revise novamente antes de fechar.",
        field: null,
        action: "REVIEW_AGAIN",
      },
    },
  });
});

test("keeps the related field in daily allocation errors", () => {
  assert.deepEqual(domainErrorResponse(domainError("DAILY_TOTAL_MISMATCH", "days")), {
    status: 400,
    body: {
      error: {
        code: "DAILY_TOTAL_MISMATCH",
        message: "A soma das horas por dia precisa ser igual ao total informado.",
        field: "days",
        action: "REVIEW_FIELDS",
      },
    },
  });
});

test("does not expose unknown infrastructure messages", () => {
  assert.deepEqual(domainErrorResponse(new Error("database password leaked here")), {
    status: 502,
    body: {
      error: {
        code: "UNEXPECTED_ERROR",
        message: "Não foi possível concluir a operação.",
        field: null,
        action: "TRY_AGAIN",
      },
    },
  });
});
