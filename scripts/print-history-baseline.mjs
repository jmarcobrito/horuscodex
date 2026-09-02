import { historyBaselineSql } from "../db/history-baseline.ts";

process.stdout.write(historyBaselineSql() + "\n");
