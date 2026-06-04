/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
/* global input, UID, tinymce */

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
  return $table.find('tbody > tr').not('.table-control-row');
}

function getColCount($table) {
  return getDataRows($table).first().children('th, td').not('.table-row-ctrl').length;
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
  let html = `<tr>${headerCell(`Row ${rowCount + 1}`)}`;
  for (let c = 1; c < colCount; c++) html += emptyCell();
  html += '</tr>';
  $table.find('tbody').append(html);
}

function doAddColumn($table) {
  const colCount = getColCount($table);
  getDataRows($table).each(function (i) {
    const $cells = $(this).children('th, td').not('.table-row-ctrl');
    const newCell = i === 0 ? headerCell(`Column ${colCount + 1}`) : emptyCell();
    $cells.last().after(newCell);
  });
}

function doRemoveRow($table, rowIndex) {
  getDataRows($table).eq(rowIndex).remove();
}

function doRemoveColumn($table, colIndex) {
  getDataRows($table).each(function () {
    $(this).children('th, td').not('.table-row-ctrl').eq(colIndex).remove();
  });
}

function doMoveRowUp($table, rowIndex) {
  if (rowIndex <= 0) return;
  const $rows = getDataRows($table);
  $rows.eq(rowIndex).insertBefore($rows.eq(rowIndex - 1));
}

function doMoveRowDown($table, rowIndex) {
  const $rows = getDataRows($table);
  if (rowIndex >= $rows.length - 1) return;
  $rows.eq(rowIndex).insertAfter($rows.eq(rowIndex + 1));
}

function doMoveColLeft($table, colIndex) {
  if (colIndex <= 0) return;
  getDataRows($table).each(function () {
    const $cells = $(this).children('th, td').not('.table-row-ctrl');
    $cells.eq(colIndex).insertBefore($cells.eq(colIndex - 1));
  });
}

function doMoveColRight($table, colIndex) {
  getDataRows($table).each(function () {
    const $cells = $(this).children('th, td').not('.table-row-ctrl');
    if (colIndex >= $cells.length - 1) return;
    $cells.eq(colIndex).insertAfter($cells.eq(colIndex + 1));
  });
}

// ── In-table row/column control buttons ───────────────────────────────────────

function buildInTableControls($table) {
  $table.find('.table-control-row').remove();
  $table.find('.table-row-ctrl').remove();

  const $rows = getDataRows($table);
  const rowCount = $rows.length;
  const colCount = getColCount($table);

  // Control row at top: one cell per data column with ←/→/✕
  const $controlRow = $('<tr class="table-edit-ui table-control-row"></tr>');
  $controlRow.append('<th class="table-edit-ui table-ctrl-corner"></th>');
  for (let c = 0; c < colCount; c++) {
    $controlRow.append(`
      <th class="table-edit-ui table-col-ctrl">
        <button class="btn btn-mini table-col-left" data-col="${c}" ${c === 0 ? 'disabled' : ''}>←</button>
        <button class="btn btn-mini table-col-right" data-col="${c}" ${c === colCount - 1 ? 'disabled' : ''}>→</button>
        <button class="btn btn-mini btn-warning table-col-remove" data-col="${c}">✕</button>
      </th>`);
  }
  $table.find('tbody').prepend($controlRow);

  // Control cell at left of each data row with ↑/↓/✕
  $rows.each(function (r) {
    const $ctrlCell = $(`
      <td class="table-edit-ui table-row-ctrl">
        <button class="btn btn-mini table-row-up" data-row="${r}" ${r === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-mini table-row-down" data-row="${r}" ${r === rowCount - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn btn-mini btn-warning table-row-remove" data-row="${r}">✕</button>
      </td>`);
    $(this).prepend($ctrlCell);
  });
}

// ── Cell editing modal ────────────────────────────────────────────────────────

const CELL_EDITOR_ID = 'cell-instruction-editor';

function destroyInstructionEditor() {
  if (typeof tinymce !== 'undefined') {
    const editor = tinymce.get(CELL_EDITOR_ID);
    if (editor) editor.remove();
  }
}

function renderCellConfig(cellType, $cellConfig, $cell) {
  destroyInstructionEditor();
  $cellConfig.empty();
  switch (cellType) {
    case 'header': {
      const currentText = $cell.find('strong').text() || '';
      $cellConfig.append(`
        <div class="control-group">
          <div class="control-label">Text</div>
          <div class="controls">
            <input type="text" id="cell-header-text" class="input-xlarge" value="${esc(currentText)}"/>
            <span class="help-inline">Displayed in bold</span>
          </div>
        </div>`);
      break;
    }
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
      let radioCount = 0;
      function addRadioOptionRow(value) {
        radioCount += 1;
        $optList.append(`
          <div class="control-group radio-option-item">
            <div class="control-label">Option ${radioCount}</div>
            <div class="controls">
              <input type="text" class="radio-option-text" value="${esc(value)}"/>
              <button class="btn btn-warning btn-small btn-remove-radio-option">−</button>
            </div>
          </div>`);
      }
      if ($radios.length > 0) {
        $radios.each(function () { addRadioOptionRow($(this).val() || `Option ${radioCount + 1}`); });
      } else {
        addRadioOptionRow('Option 1');
      }
      $cellConfig.append(
        '<div class="control-group"><div class="controls">' +
        '<button class="btn btn-primary btn-small" id="cell-add-radio-option">+ Add option</button>' +
        '</div></div>'
      );
      $cellConfig.on('click', '#cell-add-radio-option', function (e) {
        e.preventDefault();
        addRadioOptionRow(`Option ${radioCount + 1}`);
      });
      $cellConfig.on('click', '.btn-remove-radio-option', function (e) {
        e.preventDefault();
        $(this).closest('.radio-option-item').remove();
      });
      break;
    }
    case 'file': {
      const userkey = $cell.find('input[type="file"]').data('userkey') || '';
      $cellConfig.append(`
        <div class="control-group">
          <div class="control-label">User key</div>
          <div class="controls">
            <input type="text" id="cell-userkey" pattern="[a-zA-Z_0-9]{1,30}" value="${esc(userkey)}"/>
          </div>
        </div>`);
      break;
    }
    case 'instruction': {
      const currentHtml = $cell.find('.table-cell-instruction').html() || '';
      $cellConfig.append(`
        <div class="control-group">
          <div class="control-label">Instruction</div>
          <div class="controls">
            <textarea id="${CELL_EDITOR_ID}" class="input-xlarge">${currentHtml}</textarea>
          </div>
        </div>`);
      setTimeout(function () {
        $(`#${CELL_EDITOR_ID}`).tinymce({
          base_url: '/tinymce',
          license_key: 'gpl',
          promotion: false,
          suffix: '.min',
          model: 'dom',
          plugins: ['lists', 'link', 'charmap'],
          toolbar: 'undo redo | bold italic | bullist numlist | link charmap',
          menubar: false,
          setup: (editor) => {
            editor.on('change', () => editor.save());
          },
        });
      }, 0);
      break;
    }
    default:
      break;
  }
}

function applyCellType(cellType, $cellConfig, $cell) {
  switch (cellType) {
    case 'header': {
      const text = $('#cell-header-text', $cellConfig).val() || '';
      $cell.html(`<strong>${esc(text)}</strong>`);
      $cell.attr('data-cell-type', 'header');
      break;
    }
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
    case 'file': {
      const userkey = $('#cell-userkey', $cellConfig).val().trim();
      const name = $cell.find('input[type="file"]').attr('name') || UID.generateShort();
      $cell.html(
        `<input type="file" disabled="disabled" name="${name}" data-userkey="${esc(userkey)}"/>`
      );
      $cell.attr('data-cell-type', 'file');
      break;
    }
    case 'instruction': {
      let content = '';
      if (typeof tinymce !== 'undefined') {
        const editor = tinymce.get(CELL_EDITOR_ID);
        if (editor) {
          content = editor.getContent();
          editor.remove();
        }
      }
      $cell.html(`<div class="table-cell-instruction">${content}</div>`);
      $cell.attr('data-cell-type', 'instruction');
      break;
    }
    case 'empty':
    default:
      $cell.html('');
      $cell.attr('data-cell-type', 'empty');
      break;
  }
}

function openCellEditModal($cell) {
  const currentType = $cell.attr('data-cell-type') || ($cell.is('th') ? 'header' : 'empty');

  $('#modalLabel').html('Edit Cell');
  const $modalBody = $('#modal .modal-body');
  $modalBody.empty();

  $modalBody.append(`
    <div class="control-group">
      <div class="control-label">Cell type</div>
      <div class="controls">
        <select id="cell-type-select">
          <option value="header">Header</option>
          <option value="empty">Empty</option>
          <option value="text">Text input</option>
          <option value="checkbox">Checkbox</option>
          <option value="radio">Radio</option>
          <option value="file">File upload</option>
          <option value="instruction">Instruction (rich text)</option>
        </select>
      </div>
    </div>`);

  const $cellConfig = $('<div id="cell-config"></div>');
  $modalBody.append($cellConfig);

  $('#cell-type-select').val(currentType);
  renderCellConfig(currentType, $cellConfig, $cell);

  $('#cell-type-select').off('change').on('change', function () {
    renderCellConfig($(this).val(), $cellConfig, $cell);
  });

  $('#modal .modal-footer').html(
    '<button value="complete" class="btn btn-primary">Complete</button>' +
    '<button value="cancel" class="btn" data-dismiss="modal">Cancel</button>'
  );

  $('#modal button[value="complete"]').off('click').on('click', function () {
    const selectedType = $('#cell-type-select').val();
    applyCellType(selectedType, $cellConfig, $cell);
    // Swap th<->td when header type changes
    if (selectedType === 'header' && $cell.is('td')) {
      $('<th>').attr('data-cell-type', 'header').html($cell.html()).insertBefore($cell);
      $cell.remove();
    } else if (selectedType !== 'header' && $cell.is('th')) {
      $('<td>').attr('data-cell-type', selectedType).html($cell.html()).insertBefore($cell);
      $cell.remove();
    }
    $('#modal').modal('hide');
  });

  // Destroy TinyMCE if modal is dismissed without completing
  $('#modal').off('hidden.table-cell-editor').on('hidden.table-cell-editor', function () {
    destroyInstructionEditor();
  });

  $('#modal').modal('show');
}

// ── Confirmation modal ────────────────────────────────────────────────────────

function confirmThenDo(message, action) {
  $('#modalLabel').text('Confirm');
  $('#modal .modal-body').html(`<p>${message}</p>`);
  $('#modal .modal-footer').html(
    '<button value="confirm" class="btn btn-danger">Remove</button>' +
    '<button value="cancel" class="btn" data-dismiss="modal">Cancel</button>'
  );
  $('#modal button[value="confirm"]').off('click').on('click', function () {
    $('#modal').modal('hide');
    action();
  });
  $('#modal').modal('show');
}

// ── Main table_edit ───────────────────────────────────────────────────────────

export function table_edit($cgr) {
  $('#output .well.spec').remove();

  let label, $table, $tableGroup, $wrap;

  if ($cgr) {
    label = $('.table-group-label', $cgr).text() || 'Table';
    $tableGroup = $('.table-group', $cgr);
    $table = $('table.form-table', $cgr);

    if (!$table.length) {
      $table = createInitialTable();
      $tableGroup.append($table);
    }

    $wrap = $cgr;
    $wrap.attr('data-status', 'editing');

    if (!$('.control-group-buttons', $wrap).length) {
      $wrap.prepend($(input.button()).hide());
    }

    // Clean up any leftover edit UI from a previous edit session
    $tableGroup.find('.table-edit-ui').remove();
    $tableGroup.off('click.table-builder');
  } else {
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

  // Add Row / Add Column buttons (removed on Done)
  const $addRowBtn = $('<button class="btn btn-small table-add-row-btn table-edit-ui">+ Add Row</button>');
  const $addColBtn = $('<button class="btn btn-small table-add-col-btn table-edit-ui">+ Add Column</button>');
  $tableGroup.append(
    $('<div class="table-action-btns table-edit-ui"></div>')
      .append($addRowBtn).append(' ').append($addColBtn)
  );

  buildInTableControls($table);

  // Spec panel: label + Done only (row/col management is now in the table)
  const $edit = $('<div class="well spec"></div>').append(`
    <div class="control-group">
      <div class="control-label">Table Label</div>
      <div class="controls">
        <input type="text" id="table-label-input" value="${esc(label)}" class="input-xlarge"/>
      </div>
    </div>`
  ).append(
    '<div class="control-group"><div class="controls">' +
    '<button type="submit" class="btn btn-primary table-done-btn">Done</button>' +
    '</div></div>'
  );

  $wrap.after($edit);

  // ── Event handlers ────────────────────────────────────────────────────────

  $edit.on('input', '#table-label-input', function () {
    $tableGroup.find('.table-group-label').text($(this).val());
  });

  $addRowBtn.on('click', function (e) {
    e.preventDefault();
    doAddRow($table);
    buildInTableControls($table);
  });

  $addColBtn.on('click', function (e) {
    e.preventDefault();
    doAddColumn($table);
    buildInTableControls($table);
  });

  // Row controls delegated from $tableGroup so they survive control rebuilds
  $tableGroup.on('click.table-builder', '.table-row-ctrl .table-row-up', function (e) {
    e.preventDefault();
    e.stopPropagation();
    doMoveRowUp($table, parseInt($(this).data('row'), 10));
    buildInTableControls($table);
  });

  $tableGroup.on('click.table-builder', '.table-row-ctrl .table-row-down', function (e) {
    e.preventDefault();
    e.stopPropagation();
    doMoveRowDown($table, parseInt($(this).data('row'), 10));
    buildInTableControls($table);
  });

  $tableGroup.on('click.table-builder', '.table-row-ctrl .table-row-remove', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const rowIndex = parseInt($(this).data('row'), 10);
    confirmThenDo('Remove this row? This cannot be undone.', function () {
      doRemoveRow($table, rowIndex);
      buildInTableControls($table);
    });
  });

  // Column controls delegated from $tableGroup
  $tableGroup.on('click.table-builder', '.table-col-ctrl .table-col-left', function (e) {
    e.preventDefault();
    e.stopPropagation();
    doMoveColLeft($table, parseInt($(this).data('col'), 10));
    buildInTableControls($table);
  });

  $tableGroup.on('click.table-builder', '.table-col-ctrl .table-col-right', function (e) {
    e.preventDefault();
    e.stopPropagation();
    doMoveColRight($table, parseInt($(this).data('col'), 10));
    buildInTableControls($table);
  });

  $tableGroup.on('click.table-builder', '.table-col-ctrl .table-col-remove', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const colIndex = parseInt($(this).data('col'), 10);
    confirmThenDo('Remove this column? This cannot be undone.', function () {
      doRemoveColumn($table, colIndex);
      buildInTableControls($table);
    });
  });

  $edit.on('click', '.table-done-btn', function (e) {
    e.preventDefault();
    $table.find('input, textarea').each(function () {
      if (!$(this).attr('name')) $(this).attr('name', UID.generateShort());
    });
    $tableGroup.find('.table-edit-ui').remove();
    $tableGroup.off('click.table-builder');
    $edit.remove();
    $wrap.removeAttr('data-status');
    updateSectionNumbers();
  });
}

// ── Global event bindings for table editing ───────────────────────────────────

export function binding_table_events() {
  // Exclude control row/cells from the cell-click handler
  $('#output').on(
    'click',
    '.control-group-wrap[data-status="editing"] .form-table th:not(.table-col-ctrl):not(.table-ctrl-corner),' +
    '.control-group-wrap[data-status="editing"] .form-table td:not(.table-row-ctrl)',
    function (e) {
      e.preventDefault();
      e.stopPropagation();
      openCellEditModal($(this));
    }
  );
}
