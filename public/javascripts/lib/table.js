/* global fnAddFilterFoot */
export function initTableIfExists($table, config, tables) {
  if ($table.length === 0) {
    return;
  }
  // Initialize the table with the provided configuration
  const newTable = $table.DataTable(config);
  fnAddFilterFoot($table, config.aoColumns);
  tables.push(newTable);
}
