/* global moment, markFormValidity, prefix, linkTarget, travelerStatus, traveler */

export function livespan(stamp, live = true) {
  if (live) {
    return `<span data-livestamp="${stamp}"></span>`;
  }
  return `<span>${moment(stamp).format('MMM D YYYY, HH:mm:ss ZZ')}</span>`;
}

export function generateHistoryRecordHtml(
  type,
  historyValue,
  inputBy,
  inputOn,
  live = false
) {
  if (type === 'url') {
    if (historyValue !== null) {
      if (historyValue.startsWith('http') === false) {
        historyValue = `http://${historyValue}`;
      }
      historyValue = `<a target="_blank" href=${historyValue}>${historyValue}</a>`;
    }
  }
  return `changed to <strong>${historyValue}</strong> by ${inputBy} ${livespan(
    inputOn,
    live
  )}; `;
}

export function history(found) {
  let i;
  let output = '';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      const { inputType } = found[i];
      const historyValue = found[i].value;
      const { inputBy } = found[i];
      const { inputOn } = found[i];
      output =
        output +
        generateHistoryRecordHtml(inputType, historyValue, inputBy, inputOn);
    }
  }
  return output;
}

export function notes(found) {
  let i;
  let output = '<dl>';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      output = `${output}<div class="note" id=${found[i]._id} data-owner=${
        found[i].inputBy
      }><dt><b>${found[i].inputBy} created on ${livespan(
        found[i].inputOn,
        false
      )}`;
      if (found[i].updatedBy) {
        output += `, updated on ${livespan(found[i].updatedOn, false)} by ${
          found[i].updatedBy
        }`;
      }
      output += '</b>: </dt>';
      output = `${output}<dd>${found[i].value}</dd></div>`;
    }
  }
  return `${output}</dl>`;
}

export function fileHistory(found) {
  let i;
  let output = '';
  let link;
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      link = `${prefix}/data/${found[i]._id}`;
      output = `${output}<span class="file-history-item" id="${
        found[i]._id
      }"><strong><a href=${link} target="${linkTarget}" download=${
        found[i].value
      }>${found[i].value}</a></strong> uploaded by ${
        found[i].inputBy
      } ${livespan(found[i].inputOn, false)}; </span>`;
    }
  }
  return output;
}

export function renderNotes() {
  $.ajax({
    url: './notes/',
    type: 'GET',
    dataType: 'json',
  })
    .done(function(data) {
      // notes append to input/textarea not .controls
      $('#form .controls').each(function(index, controlsElement) {
        const $controlsElement = $(controlsElement);
        if ($controlsElement.children('.checkbox-set-controls').length > 0) {
          // skip the checkbox set
          return;
        }
        const inputElements = $controlsElement.find('input,textarea');
        if (inputElements.length) {
          const element = inputElements[0];
          const found = data.filter(function(e) {
            return e.name === element.name;
          });
          $(element)
            .closest('.controls')
            .append(
              `<div class="note-buttons"><b>notes</b>: <a class="notes-number" href="#" data-toggle="tooltip" title="show/hide notes"><span class="badge badge-info">${found.length}</span></a> <a class="new-note" href="#" data-toggle="tooltip" title="new note"><i class="fa fa-file-o fa-lg"></i></a></div>`
            );
          if (found.length) {
            found.sort(function(a, b) {
              if (a.inputOn > b.inputOn) {
                return -1;
              }
              return 1;
            });
            $(element)
              .closest('.controls')
              .append(
                `<div class="input-notes" style="display: none;">${notes(
                  found
                )}</div>`
              );
          }
        }
      });
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    })
    .always();
}

// Finds (or creates, positioned right below the input and above the history
// div) the single .ncr-links container a field's "Initiate NCR" button and its
// linked-NCR badges all live in, so the badges always render directly under the
// button rather than at the end of .controls (after history/notes). The "Copy
// NCR reference" button is not in here: it sits on the input's own row.
function getOrCreateNcrLinksContainer($controls) {
  let $ncrLinks = $controls.children('.ncr-links');
  if ($ncrLinks.length > 0) {
    return $ncrLinks;
  }
  $ncrLinks = $('<div class="ncr-links"></div>');
  const $history = $controls.children('.input-history');
  if ($history.length > 0) {
    $ncrLinks.insertBefore($history);
  } else {
    $controls.append($ncrLinks);
  }
  return $ncrLinks;
}

// The reference that identifies one input on this traveler, in the format the
// NCR initiation form accepts: traveler_id::input_name.
function inputReference(element) {
  return `${traveler._id}::${element.name}`;
}

// Appends the "Input" option into one field's NCR links container, ahead of the
// Initiate NCR option (spec 125 FR-007). Not offered on a traveler that is not
// active, nor while an NCR against the field is open (FR-015).
export function appendInputLink(element) {
  if (traveler.status !== 1 || !element) {
    return;
  }
  if (isInputBlockedByOpenNcr(element.name)) {
    return;
  }
  const $ncrLinks = getOrCreateNcrLinksContainer($(element).closest('.controls'));
  if ($ncrLinks.find('.input-value-link').length > 0) {
    return;
  }
  $ncrLinks.prepend(
    '<button type="button" class="input-value-link btn btn-small btn-primary"><i class="fa fa-pencil"></i> Input</button>'
  );
}

// Appends the "Initiate NCR" action into one field's .controls div — used
// both by renderNcrLinks() at page load (for every already-touched input)
// and, after a first-time save, so the action appears with no page reload.
export function appendInitiateNcrLink(element) {
  // An NCR can only be initiated against an ACTIVE traveler (spec 124); on any
  // other status the action is simply not offered.
  if (traveler.status !== 1) {
    return;
  }
  const $ncrLinks = getOrCreateNcrLinksContainer($(element).closest('.controls'));
  if ($ncrLinks.find('.initiate-ncr-link').length > 0) {
    return;
  }
  const href = `${prefix}/ncrs/new?traveler_input_ref=${encodeURIComponent(inputReference(element))}`;
  $ncrLinks.append(
    `<a class="initiate-ncr-link btn btn-warning btn-small" href="${href}" target="${linkTarget}"><i class="fa fa-exclamation-triangle"></i> Initiate NCR</a>`
  );
}

// The counted inputs of the traveler form, one per field: each .controls that
// holds a field. A checkbox set's own container is skipped, because each of its
// checkboxes sits in a .controls of its own (spec 125 FR-007).
export function inputUnits() {
  return $('#form .controls').filter(function() {
    const $controls = $(this);
    return (
      $controls.children('.checkbox-set-controls').length === 0 &&
      $controls.find('input,textarea').length > 0
    );
  });
}

// The field a unit's options and NCR rows are keyed on: its first input or textarea.
function unitField($controls) {
  return $controls.find('input,textarea')[0];
}

// Puts one input in its default state (spec 125 FR-008, FR-010): the field locked,
// and both options shown. Save and Reset are removed with the edit they belonged to.
export function lockUnit($controls) {
  $controls.find('input,textarea').prop('disabled', true);
  $controls.children('.control-group-buttons').remove();
  $controls.closest('.control-group-wrap').children('.control-group-buttons').remove();
  refreshOptions($controls);
}

// Whether a value counts as entered. Blank does not, and neither does an unticked
// box, as on the server (valueIsEmpty).
export function hasSavedValue(value) {
  if (value === null || value === undefined || value === false) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

// An input is completed once a value has been entered for it (spec 125). A completed
// input is locked and offers neither Input nor Initiate NCR.
export function markCompleted($controls, completed) {
  $controls.attr('data-completed', completed ? 'true' : null);
}

export function isCompleted($controls) {
  return $controls.attr('data-completed') === 'true';
}

// Puts an input's options in line with its state (spec 125). A completed input offers
// neither option. Otherwise it offers Input (not while an NCR against it is open) and
// Initiate NCR. An input being entered keeps the options it has, hidden.
export function refreshOptions($controls) {
  const field = unitField($controls);
  if (!field) {
    return;
  }
  if ($controls.find('input,textarea').filter(':enabled').length > 0) {
    return;
  }
  if (isCompleted($controls)) {
    $controls.find('.input-value-link, .initiate-ncr-link').remove();
    return;
  }
  appendInputLink(field);
  appendInitiateNcrLink(field);
  // while another input is being entered, every option stays unusable (spec 125 FR-012)
  const otherEntering = $('#form input, #form textarea').filter(':enabled').length > 0;
  const $options = $controls.find('.input-value-link, .initiate-ncr-link');
  if (otherEntering) {
    $options.addClass('disabled').prop('disabled', true);
  } else {
    $options.show().removeClass('disabled').prop('disabled', false);
  }
}

// Puts one input into Input mode (spec 125 FR-009): its field becomes editable,
// its Initiate NCR option is hidden, and Save and Reset are offered. While it is
// in Input mode, every other input's options are unusable (FR-012).
export function enterInputMode($controls) {
  inputUnits()
    .not($controls)
    .find('.input-value-link, .initiate-ncr-link')
    .addClass('disabled')
    .prop('disabled', true);
  $controls.find('.input-value-link, .initiate-ncr-link').hide();
  $controls.find('input,textarea').prop('disabled', false);
  // a file input is saved by its own Upload and Cancel buttons, which the change handler adds
  const isFile = $controls.find('input[type="file"]').length > 0;
  if (!isFile && $controls.children('.control-group-buttons').length === 0) {
    $controls.prepend(
      '<div class="pull-right control-group-buttons"><button value="save" class="btn btn-primary">Save</button> <button value="reset" class="btn">Reset</button></div>'
    );
  }
}

// Ends Input mode after a save, a reset or a cancelled upload (spec 125 FR-010):
// the input is locked again with both options, and every other input's options
// are usable once more.
export function leaveInputMode($controls) {
  lockUnit($controls);
  inputUnits()
    .find('.input-value-link, .initiate-ncr-link')
    .removeClass('disabled')
    .prop('disabled', false);
}

// Brings each input's Input option in line with its open NCRs: hidden while one
// is open, offered otherwise (spec 125 FR-015, FR-016).
export function syncInputOptions() {
  inputUnits().each(function() {
    const $controls = $(this);
    const field = unitField($controls);
    if (!field) {
      return;
    }
    const $ncrLinks = getOrCreateNcrLinksContainer($controls);
    if (isInputBlockedByOpenNcr(field.name)) {
      $controls.find('.input-value-link').remove();
      // the input is shown as waiting, in words, not only by the NCR badge's colour
      if ($ncrLinks.find('.input-waiting').length === 0) {
        $ncrLinks.prepend('<span class="input-waiting help-inline">Waiting on an open NCR</span>');
      }
    } else {
      $ncrLinks.find('.input-waiting').remove();
      refreshOptions($controls);
    }
  });
}

// The names of the inputs that have a linked NCR which is not Closed, filled in
// from GET ./ncr-links/ by renderNcrLinks(). Such an input does not count as
// finished (spec 124) — the server keeps the stored figure right; this keeps the
// page's own counter right without a reload.
const openNcrInputNames = new Set();

export function isInputBlockedByOpenNcr(name) {
  return openNcrInputNames.has(name);
}

// The link to one NCR: its status badge and number.
function ncrLinkElement(ncr) {
  // dynamic values go in with .attr()/.text(), never into HTML
  return $('<a class="ncr-link-badge"></a>')
    .attr('href', `${prefix}/ncrs/${encodeURIComponent(ncr.ncr_id)}`)
    .attr('target', linkTarget)
    .append($('<span class="badge"></span>').text(ncr.status))
    .append(document.createTextNode(` ${ncr.ncr_number}`));
}

// "Close report: <link>" — the PDF made when the NCR was closed (spec 124).
function closeReportElement(pdf) {
  const $link = $('<a class="ncr-pdf-link"></a>')
    .attr('href', `./ncr-pdfs/${encodeURIComponent(pdf.pdf_id)}`)
    .attr('target', linkTarget)
    .append('<i class="fa fa-file-pdf-o"></i> ')
    .append(document.createTextNode(pdf.file_name));
  return $('<span class="ncr-close-report"></span>')
    .append(document.createTextNode(' Close report: '))
    .append($link);
}

// Draws one input's NCRs in a warning box, one per row, in the order given
// (GET ./ncr-links/ returns them newest first). A closed NCR's close report goes
// on its own row, after its link. A report whose NCR is gone (an administrator
// deleted it) is still shown, on a row of its own with the NCR's number, the
// most recently closed first. There is at most one report per NCR.
function renderNcrRows($controls, ncrs, reports) {
  if (ncrs.length === 0 && reports.length === 0) {
    return;
  }
  const reportsByNcr = new Map(reports.map(pdf => [String(pdf.ncr_id), pdf]));
  const $box = $('<div class="ncr-links-existing alert"></div>');
  ncrs.forEach(function(ncr) {
    const $row = $('<div class="ncr-link-row"></div>').append(ncrLinkElement(ncr));
    const report = reportsByNcr.get(String(ncr.ncr_id));
    if (report) {
      $row.append(closeReportElement(report));
      reportsByNcr.delete(String(ncr.ncr_id));
    }
    $box.append($row);
  });
  Array.from(reportsByNcr.values())
    .reverse()
    .forEach(function(pdf) {
      $box.append(
        $('<div class="ncr-link-row"></div>')
          .append(document.createTextNode(pdf.ncr_number))
          .append(closeReportElement(pdf))
      );
    });
  getOrCreateNcrLinksContainer($controls).append($box);
}

// Renders the per-input NCR display: the "Input" and "Initiate NCR" options (on
// every input, spec 125) and, fetched from GET ./ncr-links/, a link+status
// badge for every NCR already linked to that input, listed one per row in a
// warning box, each closed NCR followed by its close report (the PDF fetched from
// GET ./ncr-pdfs/) — mirrors renderNotes()'s DOM-injection mechanics exactly.
export function renderNcrLinks() {
  $('#form .controls').each(function(index, controlsElement) {
    const $controlsElement = $(controlsElement);
    if ($controlsElement.children('.checkbox-set-controls').length > 0) {
      // skip the checkbox set
      return;
    }
    const inputElements = $controlsElement.find('input,textarea');
    if (!inputElements.length) {
      return;
    }
    const element = inputElements[0];
    // Make the container now rather than when the NCR list arrives: the notes are
    // added later, by their own request, and the list belongs above them, right
    // under the input, however the two requests happen to finish.
    getOrCreateNcrLinksContainer($controlsElement);
    if (traveler.status === 1) {
      // every input, whatever its value, starts locked with its two options (spec 125)
      lockUnit($controlsElement);
    }
    appendInputLink(element);
    appendInitiateNcrLink(element);
  });

  loadNcrBadges();
}

// Loads this traveler's NCR links and closure reports and draws them on their
// inputs. Used when the page loads and by the 30-second refresh (spec 125 US5). It
// never changes whether an input is locked, so it is safe while one is being entered.
export function loadNcrBadges() {
  const linksRequest = $.ajax({
    url: './ncr-links/',
    type: 'GET',
    dataType: 'json',
  });
  // The PDF record of each closed NCR raised against an input (spec 124). Fetched
  // separately from ncr-links because a PDF is listed even after its NCR has been
  // deleted.
  const pdfsRequest = $.ajax({
    url: './ncr-pdfs/',
    type: 'GET',
    dataType: 'json',
  });

  linksRequest
    .done(function(data) {
      openNcrInputNames.clear();
      data.forEach(function(e) {
        if (e.status !== 'Closed' && e.input_name) {
          openNcrInputNames.add(e.input_name);
        }
      });
      syncInputOptions();
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get linked NCRs</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });

  pdfsRequest.fail(function(jqXHR) {
    if (jqXHR.status !== 401) {
      $('#message').append(
        '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get NCR PDFs</div>'
      );
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });

  // A closed NCR's PDF goes on that NCR's own row, so both lists are needed before
  // anything is drawn. One that failed to load counts as empty: its alert is
  // already showing, and the other list is still worth drawing.
  const orEmpty = request =>
    request.then(
      data => data,
      () => []
    );
  $.when(orEmpty(linksRequest), orEmpty(pdfsRequest)).done(function(ncrs, pdfs) {
    $('#form .controls').each(function(index, controlsElement) {
      const $controlsElement = $(controlsElement);
      if ($controlsElement.children('.checkbox-set-controls').length > 0) {
        return;
      }
      const inputElements = $controlsElement.find('input,textarea');
      if (!inputElements.length) {
        return;
      }
      const name = inputElements[0].name;
      renderNcrRows(
        $controlsElement,
        ncrs.filter(ncr => ncr.input_name === name),
        pdfs.filter(pdf => pdf.input_name === name)
      );
    });
  });
}

export function renderHistory(binder, travelerStatus = null) {
  $.ajax({
    url: './data/',
    type: 'GET',
    dataType: 'json',
  })
    .done(function(data) {
      $('#form .controls').each(function(index, controlsElement) {
        const $controlsElement = $(controlsElement);
        if ($controlsElement.children('.checkbox-set-controls').length > 0) {
          // skip the checkbox set
          return;
        }
        const inputElements = $controlsElement.find('input,textarea');
        let currentValue;
        if (inputElements.length) {
          let element = inputElements[0];
          const found = data.filter(function(e) {
            return e.name === element.name;
          });
          if (found.length) {
            found.sort(function(a, b) {
              if (a.inputOn > b.inputOn) {
                return -1;
              }
              return 1;
            });
            if (element.type === 'file') {
              markCompleted($controlsElement, true);
              $(element)
                .closest('.controls')
                .append(
                  `<div class="input-history"><b>history</b>: ${fileHistory(
                    found
                  )}</div>`
                );
            } else {
              currentValue = found[0].value;
              markCompleted($controlsElement, hasSavedValue(currentValue));
              if (found[0].inputType === 'radio') {
                // Update element to match the value
                for (let i = 0; i < inputElements.size(); i++) {
                  const ittrInput = inputElements[i];
                  if (ittrInput.value === currentValue) {
                    element = ittrInput;
                    break;
                  }
                }
              } else if (element.type === 'number') {
                // Patch to support appropriate stepping validation for input numbers.
                element.step = 'any';
              }
              binder.deserializeFieldFromValue(element, currentValue);
              binder.accessor.set(element.name, currentValue);
              $(element)
                .closest('.controls')
                .append(
                  `<div class="input-history"><b>history</b>: ${history(
                    found
                  )}</div>`
                );
            }
          }
        }
      });

      // An active traveler's inputs stay locked until their Input option is chosen
      // (spec 125); renderNcrLinks locks them with their options.

      markFormValidity(document.getElementById('form'));

      // load the notes here
      renderNotes();

      // load the initiate-NCR actions and any already-linked NCRs
      renderNcrLinks();
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    })
    .always();
}
