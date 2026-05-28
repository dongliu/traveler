/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
/* global input, UID */

import { updateSectionNumbers } from './form-builder-shared.js';

// ── HTML escape ───────────────────────────────────────────────────────────────

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Table DOM helpers ─────────────────────────────────────────────────────────

function getDataRows($table) {
  return $table.find('tbody > tr');
}

function getColCount($table) {
  return getDataRows($table).first().children('th, td').length;
}

function headerCell(text) {
  return `<th data-cell-type="header"><strong>${esc(text)}</strong></th>`;
}

function emptyCell() {
  return '<td data-cell-type="empty"></td>';
}

// ── Initial table ─────────────────────────────────────────────────────────────

function createInitialTable() {
  const $table = $(
    '<table class="form-table table table-bordered"><tbody></tbody></table>'
  );
  const $tbody = $table.find('tbody');
  $tbody.append(`<tr>${headerCell('')}${headerCell('Column 1')}</tr>`);
  $tbody.append(`<tr>${headerCell('Row 1')}${emptyCell()}</tr>`);
  return $table;
}

// ── Add / remove / move rows and columns ──────────────────────────────────────

function doAddRow($table) {
  const colCount = getColCount($table);
  const rowCount = getDataRows($table).length;
  let html = `<tr>${headerCell(`Row ${rowCount}`)}`;
  for (let c = 1; c < colCount; c++) html += emptyCell();
  html += '</tr>';
  $table.find('tbody').append(html);
}

function doAddColumn($table) {
  const colCount = getColCount($table);
  getDataRows($table).each(function (i) {
    $(this).append(i === 0 ? headerCell(`Column ${colCount}`) : emptyCell());
  });
}

function doRemoveRow($table, rowIndex) {
  getDataRows($table).eq(rowIndex).remove();
}

function doRemoveColumn($table, colIndex) {
  getDataRows($table).each(function () {
    $(this).children('th, td').eq(colIndex).remove();
  });
}

function doMoveRowUp($table, rowIndex) {
  if (rowIndex <= 1) return;
  const $rows = getDataRows($table);
  $rows.eq(rowIndex).insertBefore($rows.eq(rowIndex - 1));
}

function doMoveRowDown($table, rowIndex) {
  const $rows = getDataRows($table);
  if (rowIndex >= $rows.length - 1) return;
  $rows.eq(rowIndex).insertAfter($rows.eq(rowIndex + 1));
}

function doMoveColLeft($table, colIndex) {
  if (colIndex <= 1) return;
  getDataRows($table).each(function () {
    const $cells = $(this).children('th, td');
    $cells.eq(colIndex).insertBefore($cells.eq(colIndex - 1));
  });
}

function doMoveColRight($table, colIndex) {
  getDataRows($table).each(function () {
    const $cells = $(this).children('th, td');
    if (colIndex >= $cells.length - 1) return;
    $cells.eq(colIndex).insertAfter($cells.eq(colIndex + 1));
  });
}

// ── Spec panel: row / column manage lists ─────────────────────────────────────

function buildRowList($table) {
  const $container = $('<div class="table-manage-list"></div>');
  const $rows = getDataRows($table);
  const total = $rows.length;
  for (let r = 1; r < total; r++) {
    const label = $rows.eq(r).find('th:first strong').text() || `Row ${r}`;
    $container.append(`
      <div class="table-manage-item">
        <span class="table-item-label">${esc(label)}</span>
        <button class="btn btn-mini table-row-up" data-row="${r}" ${r === 1 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-mini table-row-down" data-row="${r}" ${r === total - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn btn-mini btn-warning table-row-remove" data-row="${r}">✕</button>
      </div>`);
  }
  return $container;
}

function buildColList($table) {
  const $container = $('<div class="table-manage-list"></div>');
  const $cells = getDataRows($table).first().children('th, td');
  const total = $cells.length;
  for (let c = 1; c < total; c++) {
    const label = $cells.eq(c).find('strong').text() || `Column ${c}`;
    $container.append(`
      <div class="table-manage-item">
        <span class="table-item-label">${esc(label)}</span>
        <button class="btn btn-mini table-col-left" data-col="${c}" ${c === 1 ? 'disabled' : ''}>←</button>
        <button class="btn btn-mini table-col-right" data-col="${c}" ${c === total - 1 ? 'disabled' : ''}>→</button>
        <button class="btn btn-mini btn-warning table-col-remove" data-col="${c}">✕</button>
      </div>`);
  }
  return $container;
}

function refreshManageLists($table, $rowSection, $colSection) {
  $rowSection.empty().append(buildRowList($table));
  $colSection.empty().append(buildColList($table));
}

// ── Cell editing modal ────────────────────────────────────────────────────────

let _radioCount = 0;

function addRadioOptionRow($list, value) {
  _radioCount += 1;
  $list.append(`
    <div class="control-group radio-option-item">
      <div class="control-label">Option ${_radioCount}</div>
      <div class="controls">
        <input type="text" class="radio-option-text" value="${esc(value)}"/>
        <button class="btn btn-warning btn-small btn-remove-radio-option">−</button>
      </div>
    </div>`);
}

function renderCellConfig(cellType, $cellConfig, $cell) {
  $cellConfig.empty();
  switch (cellType) {
    case 'text': {
      const placeholder = $cell.find('input[type="text"]').attr('placeholder') || '';
      const userkey = $cell.find('input[type="text"]').data('userkey') || '';
      $cellConfig.append(`
        <div class="control-group">
          <div class="control-label">Placeholder</div>
          <div class="controls"><input type="text" id="cell-placeholder" value="${esc(placeholder)}"/></div>
        </div>
        <div class="control-group">
          <div class="control-label">User key</div>
          <div class="controls">
            <input type="text" id="cell-userkey" pattern="[a-zA-Z_0-9]{1,30}" value="${esc(userkey)}"/>
            <span class="help-inline">Optional</span>
          </div>
        </div>`);
      break;
    }
    case 'checkbox': {
      const text = $cell.find('label span').text() || 'check';
      const userkey = $cell.find('input[type="checkbox"]').data('userkey') || '';
      $cellConfig.append(`
        <div class="control-group">
          <div class="control-label">Text</div>
          <div class="controls"><input type="text" id="cell-checkbox-text" value="${esc(text)}"/></div>
        </div>
        <div class="control-group">
          <div class="control-label">User key</div>
          <div class="controls">
            <input type="text" id="cell-userkey" pattern="[a-zA-Z_0-9]{1,30}" value="${esc(userkey)}"/>
          </div>
        </div>`);
      break;
    }
    case 'radio': {
      const $radios = $cell.find('input[type="radio"]');
      const userkey = $radios.first().data('userkey') || '';
      $cellConfig.append(`
        <div class="control-group">
          <div class="control-label">User key</div>
          <div class="controls">
            <input type="text" id="cell-userkey" pattern="[a-zA-Z_0-9]{1,30}" value="${esc(userkey)}"/>
          </div>
        </div>`);
      const $optList = $('<div id="radio-option-list"></div>');
      $cellConfig.append($optList);
      _radioCount = 0;
      if ($radios.length > 0) {
        $radios.each(function () { addRadioOptionRow($optList, $(this).val() || `Option ${_radioCount + 1}`); });
      } else {
        addRadioOptionRow($optList, 'Option 1');
      }
      $cellConfig.append(
        '<div class="control-group"><div class="controls">' +
        '<button class="btn btn-primary btn-small" id="cell-add-radio-option">+ Add option</button>' +
        '</div></div>'
      );
      $cellConfig.on('click', '#cell-add-radio-option', function (e) {
        e.preventDefault();
        addRadioOptionRow($optList, `Option ${_radioCount + 1}`);
      });
      $cellConfig.on('click', '.btn-remove-radio-option', function (e) {
        e.preventDefault();
        $(this).closest('.radio-option-item').remove();
      });
      break;
    }
    default:
      break;
  }
}

function applyCellType(cellType, $cellConfig, $cell) {
  switch (cellType) {
    case 'text': {
      const placeholder = $('#cell-placeholder', $cellConfig).val().trim();
      const userkey = $('#cell-userkey', $cellConfig).val().trim();
      const name = $cell.find('input[type="text"]').attr('name') || UID.generateShort();
      $cell.html(
        `<input type="text" disabled="disabled" placeholder="${esc(placeholder)}" name="${name}" data-userkey="${esc(userkey)}"/>`
      );
      $cell.attr('data-cell-type', 'text');
      break;
    }
    case 'checkbox': {
      const text = $('#cell-checkbox-text', $cellConfig).val().trim();
      const userkey = $('#cell-userkey', $cellConfig).val().trim();
      const name = $cell.find('input[type="checkbox"]').attr('name') || UID.generateShort();
      $cell.html(
        `<label class="checkbox"><input type="checkbox" disabled="disabled" name="${name}" data-userkey="${esc(userkey)}"/><span>${esc(text)}</span></label>`
      );
      $cell.attr('data-cell-type', 'checkbox');
      break;
    }
    case 'radio': {
      const userkey = $('#cell-userkey', $cellConfig).val().trim();
      const name = $cell.find('input[type="radio"]').first().attr('name') || UID.generateShort();
      const options = [];
      $('.radio-option-text', $cellConfig).each(function () {
        const v = $(this).val().trim();
        if (v) options.push(v);
      });
      if (options.length === 0) options.push('Option 1');
      $cell.html(
        options.map(opt =>
          `<label class="radio"><input type="radio" disabled="disabled" name="${name}" value="${esc(opt)}" data-userkey="${esc(userkey)}"/><span>${esc(opt)}</span></label>`
        ).join('')
      );
      $cell.attr('data-cell-type', 'radio');
      break;
    }
    case 'empty':
    default:
      $cell.html('');
      $cell.attr('data-cell-type', 'empty');
      break;
  }
}

function openCellEditModal($cell, $table) {
  const isHeader = $cell.is('th');

  $('#modalLabel').html(isHeader ? 'Edit Header Cell' : 'Edit Cell');
  const $modalBody = $('#modal .modal-body');
  $modalBody.empty();

  if (isHeader) {
    const currentText = $cell.find('strong').text();
    $modalBody.append(`
      <div class="control-group">
        <div class="control-label">Text</div>
        <div class="controls">
          <input type="text" id="cell-header-text" class="input-xlarge" value="${esc(currentText)}"/>
          <span class="help-inline">Displayed in bold</span>
        </div>
      </div>`);
    $('#modal .modal-footer').html(
      '<button value="complete" class="btn btn-primary">Complete</button>' +
      '<button value="cancel" class="btn" data-dismiss="modal">Cancel</button>'
    );
    $('#modal button[value="complete"]').off('click').on('click', function () {
      $cell.html(`<strong>${esc($('#cell-header-text').val())}</strong>`);
      $('#modal').modal('hide');
    });
  } else {
    const cellType = $cell.attr('data-cell-type') || 'empty';
    $modalBody.append(`
      <div class="control-group">
        <div class="control-label">Cell type</div>
        <div class="controls">
          <select id="cell-type-select">
            <option value="empty">Empty</option>
            <option value="text">Text input</option>
            <option value="checkbox">Checkbox</option>
            <option value="radio">Radio</option>
          </select>
        </div>
      </div>`);
    const $cellConfig = $('<div id="cell-config"></div>');
    $modalBody.append($cellConfig);

    $('#cell-type-select').val(cellType);
    renderCellConfig(cellType, $cellConfig, $cell);
    $('#cell-type-select').off('change').on('change', function () {
      renderCellConfig($(this).val(), $cellConfig, $cell);
    });

    $('#modal .modal-footer').html(
      '<button value="complete" class="btn btn-primary">Complete</button>' +
      '<button value="cancel" class="btn" data-dismiss="modal">Cancel</button>'
    );
    $('#modal button[value="complete"]').off('click').on('click', function () {
      applyCellType($('#cell-type-select').val(), $cellConfig, $cell);
      $('#modal').modal('hide');
    });
  }

  $('#modal').modal('show');
}

// ── Main table_edit ───────────────────────────────────────────────────────────

export function table_edit($cgr) {
  $('#output .well.spec').remove();

  let label, $table, $tableGroup, $wrap;

  if ($cgr) {
    // ── Edit existing table in-place (no cloning, no DOM replacement) ──────
    label = $('.table-group-label', $cgr).text() || 'Table';
    $tableGroup = $('.table-group', $cgr);
    $table = $('table.form-table', $cgr);

    if (!$table.length) {
      // Defensive fallback: table missing somehow — rebuild fresh
      $table = createInitialTable();
      $tableGroup.append($table);
    }

    $wrap = $cgr;
    $wrap.attr('data-status', 'editing');

    // Ensure the edit/duplicate/remove buttons are present (hover may not have
    // fired yet if the user triggered edit via keyboard or programmatically)
    if (!$('.control-group-buttons', $wrap).length) {
      $wrap.prepend($(input.button()).hide());
    }
  } else {
    // ── New table ───────────────────────────────────────────────────────────
    label = 'Table';
    $table = createInitialTable();

    $tableGroup = $('<div class="control-group table-group"></div>');
    $tableGroup.append('<span class="table-group-number"></span>&nbsp;');
    $tableGroup.append(`<span class="table-group-label">${esc(label)}</span>`);
    $tableGroup.append($table);

    $wrap = $(
      '<div class="control-group-wrap" data-status="editing"><span class="fe-type">table</span></div>'
    ).append($tableGroup);
    $wrap.prepend($(input.button()).hide());
    $('#output').append($wrap);
  }

  // Add Row / Add Column buttons (edit-only, removed on Done)
  const $addRowBtn = $('<button class="btn btn-small table-add-row-btn table-edit-ui">+ Add Row</button>');
  const $addColBtn = $('<button class="btn btn-small table-add-col-btn table-edit-ui">+ Add Column</button>');
  $tableGroup.append(
    $('<div class="table-action-btns table-edit-ui"></div>')
      .append($addRowBtn).append(' ').append($addColBtn)
  );

  // Build spec panel
  const $rowSection = $('<div></div>');
  const $colSection = $('<div></div>');

  const $edit = $('<div class="well spec"></div>').append(`
    <div class="control-group">
      <div class="control-label">Table Label</div>
      <div class="controls">
        <input type="text" id="table-label-input" value="${esc(label)}" class="input-xlarge"/>
      </div>
    </div>`
  ).append(
    $('<div class="control-group"><div class="control-label">Rows</div></div>')
      .append($('<div class="controls"></div>').append($rowSection))
  ).append(
    $('<div class="control-group"><div class="control-label">Columns</div></div>')
      .append($('<div class="controls"></div>').append($colSection))
  ).append(
    '<div class="control-group"><div class="controls">' +
    '<button type="submit" class="btn btn-primary table-done-btn">Done</button>' +
    '</div></div>'
  );

  $wrap.after($edit);

  refreshManageLists($table, $rowSection, $colSection);

  // ── Event handlers ────────────────────────────────────────────────────────

  $edit.on('input', '#table-label-input', function () {
    $tableGroup.find('.table-group-label').text($(this).val());
  });

  $addRowBtn.on('click', function (e) {
    e.preventDefault();
    doAddRow($table);
    refreshManageLists($table, $rowSection, $colSection);
  });

  $addColBtn.on('click', function (e) {
    e.preventDefault();
    doAddColumn($table);
    refreshManageLists($table, $rowSection, $colSection);
  });

  $edit.on('click', '.table-row-up', function (e) {
    e.preventDefault();
    doMoveRowUp($table, parseInt($(this).data('row'), 10));
    refreshManageLists($table, $rowSection, $colSection);
  });

  $edit.on('click', '.table-row-down', function (e) {
    e.preventDefault();
    doMoveRowDown($table, parseInt($(this).data('row'), 10));
    refreshManageLists($table, $rowSection, $colSection);
  });

  $edit.on('click', '.table-row-remove', function (e) {
    e.preventDefault();
    doRemoveRow($table, parseInt($(this).data('row'), 10));
    refreshManageLists($table, $rowSection, $colSection);
  });

  $edit.on('click', '.table-col-left', function (e) {
    e.preventDefault();
    doMoveColLeft($table, parseInt($(this).data('col'), 10));
    refreshManageLists($table, $rowSection, $colSection);
  });

  $edit.on('click', '.table-col-right', function (e) {
    e.preventDefault();
    doMoveColRight($table, parseInt($(this).data('col'), 10));
    refreshManageLists($table, $rowSection, $colSection);
  });

  $edit.on('click', '.table-col-remove', function (e) {
    e.preventDefault();
    doRemoveColumn($table, parseInt($(this).data('col'), 10));
    refreshManageLists($table, $rowSection, $colSection);
  });

  $edit.on('click', '.table-done-btn', function (e) {
    e.preventDefault();
    // Assign unique names to any cell inputs that don't have one yet
    $table.find('input, textarea').each(function () {
      if (!$(this).attr('name')) $(this).attr('name', UID.generateShort());
    });
    // Remove edit-only UI elements
    $tableGroup.find('.table-edit-ui').remove();
    // Close spec
    $edit.remove();
    $wrap.removeAttr('data-status');
    updateSectionNumbers();
  });
}

// ── Global event bindings for table editing ───────────────────────────────────

export function binding_table_events() {
  // Cell click opens modal only when the parent wrap is in editing mode
  $('#output').on(
    'click',
    '.control-group-wrap[data-status="editing"] .form-table th,' +
    '.control-group-wrap[data-status="editing"] .form-table td',
    function (e) {
      e.preventDefault();
      e.stopPropagation();
      openCellEditModal($(this), $(this).closest('.form-table'));
    }
  );
}
