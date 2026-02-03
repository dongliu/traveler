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

/**
 * generate the aaSorting config for DataTable
 * @param {*} table config object
 * @param {*} column
 * @param {*} order
 */
export function sortByColumn(config, column, order = 'desc') {
  const index = config.aoColumns?.indexOf(column);
  if (index === -1) {
    return;
  }
  if (!config.aaSorting) {
    config.aaSorting = [];
  }
  config.aaSorting.push([index, order]);
}
