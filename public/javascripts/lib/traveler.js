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

// Copies text to the clipboard. The async Clipboard API needs a secure context
// (https or localhost), so a plain-http deployment falls back to a temporary
// textarea and execCommand. Resolves to whether either way worked.
function copyToClipboard(text) {
  if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => false);
  }
  const $textarea = $('<textarea readonly></textarea>')
    .css({ position: 'fixed', top: 0, left: 0, opacity: 0 })
    .val(text)
    .appendTo('body');
  $textarea[0].select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (err) {
    copied = false;
  }
  $textarea.remove();
  return Promise.resolve(copied);
}

// The button whose popup is open, if any. Only one popup is open at a time.
let $openRefButton = null;

function closeRefPopup({ restoreFocus = false } = {}) {
  if (!$openRefButton) {
    return;
  }
  const $button = $openRefButton;
  $openRefButton = null;
  $button.popover('hide').attr('aria-expanded', 'false');
  if (restoreFocus) {
    $button.trigger('focus');
  }
}

// Registered once, on first use: a mousedown outside the open popup (and its
// button) or Escape closes it. mousedown rather than click, so dragging a text
// selection out of the popup does not dismiss it.
let refPopupDismissBound = false;
function bindRefPopupDismiss() {
  if (refPopupDismissBound) {
    return;
  }
  refPopupDismissBound = true;
  $(document).on('mousedown', function(e) {
    if ($openRefButton && $(e.target).closest('.ncr-ref-popover, .copy-ncr-ref').length === 0) {
      closeRefPopup();
    }
  });
  $(document).on('keydown', function(e) {
    if (e.key === 'Escape' && $openRefButton) {
      closeRefPopup({ restoreFocus: true });
    }
  });
}

// The contents of one reference popup: the reference in a read-only field, so it
// can be selected and copied by hand, and a Copy button that puts it on the
// clipboard. Built afresh on every open (Bootstrap empties the popup when it is
// reshown, which would drop handlers bound to a kept element).
function buildRefPopupContent(reference) {
  const $content = $('<div class="ncr-ref-popup"></div>');
  const $value = $('<input type="text" readonly class="ncr-ref-value" aria-label="NCR reference">').val(
    reference
  );
  const $copy = $('<button type="button" class="ncr-ref-copy btn btn-primary"></button>')
    .append('<i class="fa fa-clipboard"></i> ')
    .append('<span class="ncr-ref-copy-text">Copy</span>');
  const $status = $('<div class="ncr-ref-status help-block" role="status"></div>');
  $content.append(
    '<div class="help-block">Paste this into the NCR form to link an NCR to this input.</div>',
    $('<div class="input-append"></div>').append($value, $copy),
    $status
  );

  let resetTimer = null;
  $copy.on('click', function() {
    copyToClipboard(reference).then(function(copied) {
      $value[0].select();
      clearTimeout(resetTimer);
      if (!copied) {
        $status.text('Could not copy automatically. Press Ctrl+C (⌘C on a Mac) to copy the selected text.');
        return;
      }
      $status.text('');
      $copy.find('.ncr-ref-copy-text').text('Copied');
      resetTimer = setTimeout(function() {
        $copy.find('.ncr-ref-copy-text').text('Copy');
      }, 1500);
    });
  });
  return $content;
}

// Finds the element the reference button goes right after, so that it sits on
// the input's own row: the input itself, or the wrapper it is drawn inside — the
// unit box of a number-with-unit input, or the label of a checkbox / radio —
// then past a short inline hint (a number's range) that belongs to the input.
function refButtonAnchor(element) {
  let $anchor = $(element).closest('.input-append, label.checkbox, label.radio');
  if ($anchor.length === 0) {
    $anchor = $(element);
  } else if ($anchor.is('label')) {
    // a label is block-level: let the button share its line
    $anchor.addClass('ncr-ref-row');
  }
  const $hint = $anchor.next('.help-inline');
  return $hint.length > 0 ? $hint : $anchor;
}

// Adds the "Copy NCR reference" button to the right of one input, on the same
// row. Clicking it opens a popup that reveals traveler_id::input_name, ready to
// be copied (with the popup's Copy button, or by selecting the text) and pasted
// into the NCR form. Offered on EVERY input, filled or not, on a traveler in any
// status.
export function appendCopyRefControl(element) {
  if (!element.name) {
    return;
  }
  const $controls = $(element).closest('.controls');
  if ($controls.find('.copy-ncr-ref').length > 0) {
    return;
  }
  const reference = inputReference(element);
  const $button = $(
    '<button type="button" class="copy-ncr-ref btn btn-mini" aria-haspopup="dialog" aria-expanded="false"></button>'
  ).append('<i class="fa fa-clipboard"></i> Copy NCR reference');
  $button.popover({
    trigger: 'manual',
    html: true,
    container: 'body',
    placement: 'bottom',
    title: 'NCR reference',
    content: () => buildRefPopupContent(reference),
    template:
      '<div class="popover ncr-ref-popover" role="dialog"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>',
  });
  $button.on('click', function() {
    const wasOpen = $openRefButton && $openRefButton[0] === $button[0];
    closeRefPopup();
    if (wasOpen) {
      return;
    }
    bindRefPopupDismiss();
    $button.popover('show').attr('aria-expanded', 'true');
    $openRefButton = $button;
    // leave the reference selected so Ctrl/Cmd+C works straight away
    const value = $button.data('popover').tip().find('.ncr-ref-value')[0];
    if (value) {
      value.focus();
      value.select();
    }
  });
  refButtonAnchor(element).after($button);
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

// Renders the per-input NCR display: the "Copy NCR reference" control (on
// every input), the "Initiate NCR" action (for any input already in
// traveler.touchedInputs) and, fetched from GET ./ncr-links/, a link+status
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
    appendCopyRefControl(element);
    // Make the container now rather than when the NCR list arrives: the notes are
    // added later, by their own request, and the list belongs above them, right
    // under the input, however the two requests happen to finish.
    getOrCreateNcrLinksContainer($controlsElement);
    if (traveler.touchedInputs && traveler.touchedInputs.indexOf(element.name) !== -1) {
      appendInitiateNcrLink(element);
    }
  });

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
              $(element)
                .closest('.controls')
                .append(
                  `<div class="input-history"><b>history</b>: ${fileHistory(
                    found
                  )}</div>`
                );
            } else {
              currentValue = found[0].value;
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

      // check if active here
      if (travelerStatus === 1) {
        $('#form input,textarea').prop('disabled', false);
      }

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
