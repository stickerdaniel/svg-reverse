// Initialize Ace Editor for the input
let editor = ace.edit("input-editor");
editor.setTheme("ace/theme/dracula"); // Light theme
editor.session.setMode("ace/mode/svg");
editor.setValue(defaultSvg, -1); // Set initial content
editor.renderer.setShowPrintMargin(false); // Remove the gray line

// Initialize Ace Editor for the output (result)
let resultEditor = ace.edit("output-editor");
resultEditor.setTheme("ace/theme/dracula");
resultEditor.session.setMode("ace/mode/svg");
resultEditor.setReadOnly(true); // Make the editor read-only
resultEditor.renderer.setShowPrintMargin(false); // Remove the gray line

// this array will store the indexes of paths that are reversed
let reversedPaths = [];

// variables to store SVG content
let originalSvg = '';
let modifiedSvg = '';

// Variable to store the animation scale
let animationScale = 1; // Default scale

// Define arrays for easing functions and types
const easingFunctions = [
    'linear',
    'power1',
    'power2',
    'power3',
    'power4',
    'back',
    'bounce',
    'circ',
    'elastic',
    'expo',
    'sine',
    'steps'
];

const easingTypes = ['.in', '.out', '.inOut'];

$('#parse-btn').on('click', function () {
    const svgCode = editor.getValue();

    // Check if the SVG code is empty
    if (svgCode.trim() === "") {
        showSwal('No SVG code', 'Please enter an SVG code!', false);
        return;
    }
    originalSvg = svgCode;
    $.ajax({
        url: '/process-svg', type: 'POST', data: {svg_code: svgCode}, success: function (response) {
            const data = response.paths;
            originalSvg = response.updated_svg;
            $('#path-list').empty();
            reversedPaths = [];  // Reset reversed paths on each parse

            // Check if any paths are found in the SVG
            if (data.length === 0) {
                showSwal('No Paths Found', 'No paths found in the SVG!', false);
                showResultUI(false);
                // Track parsing failure
                if (typeof umami !== 'undefined') {
                    umami.track('processing_error', {
                        error_type: 'parse',
                        error_message: 'no_paths_found',
                        svg_size: svgCode.length > 10000 ? 'large' : svgCode.length > 2000 ? 'medium' : 'small'
                    });
                }
                return;
            }

            showResultUI(true);

            data.forEach(function (path, index) {
                const checkbox = `<input type="checkbox" id="path${index}" value="${index}" class="checkbox checkbox-lg" checked>`;
                const statusBadge = `<span id="status${index}" class="badge badge-success badge-lg w-24 text-center m-1">reversed</span>`;
                let pathIdBadge = '';
                let pathClassBadge = '';
                // Get duration and delay from path
                let durationValue = path.duration || '';
                let delayValue = path.delay || '';
                const animationDurationInput = `<div class="tooltip" data-tip="duration"><input type="text" value="${durationValue}" placeholder="2" class="input-duration input input-bordered input-accent input-sm md:input-xs w-20 text-center" /></div>`;
                const animationDelayInput = `<div class="tooltip" data-tip="delay"><input type="text" value="${delayValue}" placeholder="0" class="input-delay input input-bordered input-accent input-sm md:input-xs w-20 text-center" /></div>`;

                // id badge
                if (path.id) {
                    pathIdBadge = `<span class="badge badge-secondary badge-lg">#${path.id}</span>`;
                }
                // class badge
                if (path.class) {
                    // Filter out 'duration-*', 'delay-*', and 'animate' classes
                    let filteredClasses = path.class.split(' ').filter(cls => {
                        return !cls.startsWith('duration-') && !cls.startsWith('delay-') && cls !== 'animate';
                    }).join(' ');
                    if (filteredClasses) {
                        pathClassBadge = `<span class="badge badge-primary badge-lg ml-1 whitespace-nowrap">${filteredClasses}</span>`;
                    }
                }
                // start value badge - only show for paths without an ID
                let startBadge = '';
                if (!path.id && path.start) {
                    // Parse the coordinates and format with 2 decimal places
                    const coords = path.start.match(/[\d.]+/g);
                    if (coords && coords.length >= 2) {
                        const x = parseFloat(coords[0]).toFixed(2);
                        const y = parseFloat(coords[1]).toFixed(2);
                        const startValue = `(${x}, ${y})`;
                        startBadge = `<span class="badge badge-info badge-lg ml-1 text-nowrap">${startValue}...</span>`;
                    }
                }

                // Get easing from path
                let easingValue = path.easing || '';
                let easingFunction = '';
                let easingType = '';
                if (easingValue) {
                    let parts = easingValue.split('.');
                    easingFunction = parts[0]; // e.g., 'power2'
                    easingType = parts[1] ? '.' + parts[1] : ''; // e.g., '.out'
                }

                // Create easing function options
                function createEasingFunctionOptions(selectedFunction) {
                    return easingFunctions.map(function (easeFunc) {
                        let selected = (easeFunc === selectedFunction || (!selectedFunction && easeFunc === 'power1')) ? 'selected' : '';
                        return `<option value="${easeFunc}" ${selected}>${easeFunc}</option>`;
                    }).join('');
                }

                // Create easing type options
                function createEasingTypeOptions(selectedType) {
                    return easingTypes.map(function (easeType) {
                        let label = easeType.replace('.', '') || 'out'; // Default to 'out' if empty
                        let selected = (easeType === selectedType || (!selectedType && easeType === '.out')) ? 'selected' : '';
                        return `<option value="${easeType}" ${selected}>${label}</option>`;
                    }).join('');
                }

                const easingFunctionSelect = `<div class="tooltip" data-tip="easing function"><select class="select-easing-function select select-accent select-sm md:select-xs">
                ${createEasingFunctionOptions(easingFunction)}
                </select></div>`;

                const easingTypeSelect = `<div class="tooltip" data-tip="easing type"><select class="select-easing-type select select-accent select-sm md:select-xs">
                ${createEasingTypeOptions(easingType)}
                </select></div>`;

                // Append the path item with the new selects
                $('#path-list').append(`
                    <div class="path-item flex flex-col sm:flex-row gap-2 py-2">
                        <div class="flex items-center gap-2">
                            ${checkbox}
                            ${statusBadge}
                            <div class="flex items-center gap-2 min-w-0">
                                ${pathIdBadge}
                                ${pathClassBadge}
                                ${startBadge}
                            </div>
                        </div>
                        <div class="flex items-center gap-1 sm:ml-auto">
                            ${animationDurationInput}
                            ${animationDelayInput}
                            ${easingFunctionSelect}
                            ${easingTypeSelect}
                        </div>
                    </div>
                `);

                // Add path index to reversedPaths
                reversedPaths.push(index);
            });

            // Update the SVG with all paths reversed
            updateSvgWithReversedPaths();

            // Update the result editor with the initial updated SVG
            resultEditor.setValue(originalSvg, -1);

            // Render the original SVG in the preview
            $('#svg-preview').html(originalSvg);

            // Track successful SVG parsing
            if (typeof umami !== 'undefined') {
                const hasClasses = data.some(path => path.class);
                const hasIds = data.some(path => path.id);
                const hasAnimationClasses = data.some(path => path.duration || path.delay || path.easing);
                
                umami.track('svg_parsed', {
                    paths_found: data.length,
                    has_classes: hasClasses,
                    has_ids: hasIds,
                    has_animation_classes: hasAnimationClasses,
                    svg_size: svgCode.length > 10000 ? 'large' : svgCode.length > 2000 ? 'medium' : 'small'
                });
            }
        }, error: function (xhr) {
            showSwal('Error', 'Error parsing the SVG!\n' + xhr.responseText, false);
            // Track parsing error
            if (typeof umami !== 'undefined') {
                umami.track('processing_error', {
                    error_type: 'parse',
                    error_message: 'svg_parse_failed',
                    status_code: xhr.status,
                    svg_size: svgCode.length > 10000 ? 'large' : svgCode.length > 2000 ? 'medium' : 'small'
                });
            }
        }
    });
});

// File upload handler
$('#file-input').on('change', function(event) {
    const file = event.target.files[0];
    if (file && file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = function(e) {
            const svgContent = e.target.result;
            editor.setValue(svgContent, -1);
            
            // Track file upload
            if (typeof umami !== 'undefined') {
                umami.track('svg_file_uploaded', {
                    file_size: file.size > 10000 ? 'large' : file.size > 2000 ? 'medium' : 'small',
                    file_name_has_extension: file.name.endsWith('.svg')
                });
            }
            
            // Automatically trigger the parse functionality
            $('#parse-btn').click();
        };
        reader.readAsText(file);
    } else {
        showSwal('Invalid File', 'Please select a valid SVG file.', false);
        
        // Track invalid file upload
        if (typeof umami !== 'undefined') {
            umami.track('processing_error', {
                error_type: 'upload',
                error_message: 'invalid_file_type',
                file_type: file ? file.type : 'unknown'
            });
        }
    }
    
    // Reset the input so the same file can be selected again
    event.target.value = '';
});

$(document).on('change', '#path-list input:checkbox', function () {
    const pathIndex = parseInt($(this).val(), 10);
    const isChecked = $(this).is(':checked');
    const index = $(this).attr('id').replace('path', '');

    // Add or remove from reversedPaths array based on toggle
    if (isChecked) {
        // Add path index to reversedPaths
        reversedPaths.push(pathIndex);
        // Update the status badge
        $('#status' + index).text('reversed').removeClass('badge-outline').addClass('badge-success');
    } else {
        // Remove path index from reversedPaths
        reversedPaths = reversedPaths.filter(idx => idx !== pathIndex);
        // Update the status badge
        $('#status' + index).text('normal').removeClass('badge-success').addClass('badge-outline');
    }

    // Track path toggle event
    if (typeof umami !== 'undefined') {
        const pathItem = $(this).closest('.path-item');
        const hasId = pathItem.find('.badge-secondary').length > 0;
        const hasClasses = pathItem.find('.badge-primary').length > 0;
        
        umami.track('path_toggled', {
            action: isChecked ? 'reversed' : 'normal',
            path_index: pathIndex,
            total_paths: $('#path-list input:checkbox').length,
            reversed_paths_count: reversedPaths.length,
            has_id: hasId,
            has_classes: hasClasses
        });
    }

    // Update the SVG with the reversed paths
    updateSvgWithReversedPaths();
});

// Function to update the SVG with the reversed paths
function updateSvgWithReversedPaths() {
    // Collect duration, delay, and easing values
    let pathData = [];
    $('#path-list .path-item').each(function(index) {
        let duration = $(this).find('.input-duration').val();
        let delay = $(this).find('.input-delay').val();
        let easingFunction = $(this).find('.select-easing-function').val();
        let easingType = $(this).find('.select-easing-type').val();
        let easing = '';
        if (easingFunction) {
            easing = easingFunction;
            if (easingType) {
                easing += easingType;
            }
        }
        pathData.push({
            index: index,
            duration: duration,
            delay: delay,
            easing: easing
        });
    });

    $.ajax({
        url: '/reverse-paths',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            svg_code: originalSvg,
            paths_to_reverse: reversedPaths,
            path_data: pathData  // Send duration, delay, and easing data
        }),
        success: function (data) {
            modifiedSvg = data.updated_svg;

            // Update the result editor
            resultEditor.setValue(modifiedSvg, -1);

            // Render the updated SVG
            $('#svg-preview').html(modifiedSvg);

            // Trigger a reflow to fix the SVG height issue
            const elm = document.getElementById('svg-preview');
            elm.style.height = elm.offsetHeight + 1 + 'px';
            elm.style.height = elm.offsetHeight - 1 + 'px';
        },
        error: function (xhr) {
            showSwal('Error', 'Error updating the SVG with reversed paths!\n' + xhr.responseText, false);
            // Track reverse paths error
            if (typeof umami !== 'undefined') {
                umami.track('processing_error', {
                    error_type: 'reverse',
                    error_message: 'path_reverse_failed',
                    status_code: xhr.status,
                    paths_to_reverse: reversedPaths.length
                });
            }
        }
    });
}

// Function to show/hide the result UI elements after parsing SVG
function showResultUI(show) {
    if (show) {
        $('#paths-heading').show();
        $('#updated-svg-container').show();
        $('#settings').show();
    } else {
        $('#paths-heading').hide();
        $('#updated-svg-container').hide();
        $('#settings').hide();
    }
}

// event listener for copy button to copy the updated SVG to clipboard
$('#copy-btn').on('click', function () {
    navigator.clipboard.writeText(modifiedSvg).then(function () {
        showSwal('Copied!', 'Updated SVG copied to clipboard.', true);
        
        // Track successful copy
        if (typeof umami !== 'undefined') {
            umami.track('svg_copied', {
                paths_total: $('#path-list input:checkbox').length,
                paths_reversed: reversedPaths.length,
                svg_size: modifiedSvg.length > 10000 ? 'large' : modifiedSvg.length > 2000 ? 'medium' : 'small',
                has_animation_data: $('.input-duration').filter(function() { return $(this).val() !== ''; }).length > 0
            });
        }
    }, function () {
        showSwal('Copy Failed', 'Failed to copy the updated SVG!', false);
        
        // Track copy failure
        if (typeof umami !== 'undefined') {
            umami.track('processing_error', {
                error_type: 'copy',
                error_message: 'clipboard_failed'
            });
        }
    });
});

$('#download-btn').on('click', function () {
    const modifiedSvg = resultEditor.getValue();  // Get the modified SVG from the editor

    // Make an AJAX request to the server to download the zip file
    $.ajax({
        url: '/download-animation',
        type: 'POST',
        contentType: 'application/json',
        // Send the modified SVG and animation scale to the server
        data: JSON.stringify({svg_code: modifiedSvg, animation_scale: animationScale}),
        xhrFields: {
            responseType: 'blob'  // Set the response type to blob
        },
        success: function (data, status, xhr) {
            const contentType = xhr.getResponseHeader('Content-Type');

            // Handle response as a ZIP if it's binary
            if (contentType === 'application/zip') {
                const blob = new Blob([data], { type: 'application/zip' });
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);  // Create a URL for the blob
                link.download = 'animation.zip';  // Specify the filename
                document.body.appendChild(link);
                link.click();  // Programmatically click the link to trigger the download
                document.body.removeChild(link);  // Clean up after download
                showSwal('Download Complete', 'The animation.zip has been downloaded successfully!', true);
                
                // Track successful download
                if (typeof umami !== 'undefined') {
                    const hasCustomTiming = $('.input-duration').filter(function() { return $(this).val() !== ''; }).length > 0 ||
                                          $('.input-delay').filter(function() { return $(this).val() !== ''; }).length > 0;
                    const customEasing = $('.select-easing-function').filter(function() { return $(this).val() !== 'power1'; }).length > 0;
                    
                    umami.track('animation_downloaded', {
                        paths_total: $('#path-list input:checkbox').length,
                        paths_reversed: reversedPaths.length,
                        animation_scale: animationScale,
                        has_custom_timing: hasCustomTiming,
                        has_custom_easing: customEasing,
                        svg_size: modifiedSvg.length > 10000 ? 'large' : modifiedSvg.length > 2000 ? 'medium' : 'small'
                    });
                }
            } else if (contentType === 'text/plain') {
                // Handle plain text error messages
                showSwal('Download Failed', `Error: ${data}`, false);
                
                // Track download error
                if (typeof umami !== 'undefined') {
                    umami.track('processing_error', {
                        error_type: 'download',
                        error_message: 'download_failed_text_error'
                    });
                }
            }
        },
        error: function (xhr) {
            const contentType = xhr.getResponseHeader('Content-Type');

            // Handle plain text error messages
            if (contentType === 'text/plain') {
                showSwal('Download Failed', `Error: ${xhr.responseText}`, false);
            } else {
                showSwal('Download Failed', 'An unexpected error occurred while downloading the animation zip.', false);
            }
            
            // Track download error
            if (typeof umami !== 'undefined') {
                umami.track('processing_error', {
                    error_type: 'download',
                    error_message: 'download_failed_xhr_error',
                    status_code: xhr.status
                });
            }
        }
    });
});


// event listeners for animation buttons to animate the SVG paths
$('#animate-original').on('click', function () {
    // Display the original SVG
    $('#svg-preview').html(originalSvg);
    // Animate the paths
    let svgElement = $('#svg-preview svg')[0];
    animateSVGPaths(svgElement, animationScale);
    
    // Track animation preview
    if (typeof umami !== 'undefined') {
        umami.track('animation_previewed', {
            type: 'original',
            paths_count: $('#path-list input:checkbox').length,
            animation_scale: animationScale,
            reversed_paths: reversedPaths.length
        });
    }
});
$('#animate-edited').on('click', function () {
    // Display the modified SVG
    $('#svg-preview').html(modifiedSvg);
    // Animate the paths
    let svgElement = $('#svg-preview svg')[0];
    animateSVGPaths(svgElement, animationScale);
    
    // Track animation preview
    if (typeof umami !== 'undefined') {
        umami.track('animation_previewed', {
            type: 'edited',
            paths_count: $('#path-list input:checkbox').length,
            animation_scale: animationScale,
            reversed_paths: reversedPaths.length
        });
    }
});

// sweetalert2 configuration
function showSwal(title, text, success) {
    Swal.fire({
        icon: success ? 'success' : 'error',
        title: title,
        text: text,
        confirmButtonText: 'OK',
        buttonsStyling: false,
        customClass: {
            confirmButton: 'btn btn-primary px-6 rounded-full', // Apply DaisyUI button styles
            popup: 'rounded-box bg-base-100 shadow-lg',
            title: 'text-base-content',
            htmlContainer: 'text-base-content',
        },
    });
}

// Cache the necessary DOM elements
const $speedSlider = $('#speed-slider');
const $speedBadge = $('#speed-badge');
const $pathList = $('#path-list');

// Capture speed factor from the slider and update the badge
$speedSlider.on('input', function () {
    const speedPercent = parseFloat($(this).val());
    $speedBadge.text(`${speedPercent}%`);
    animationScale = speedPercent * 0.01;
    // No need to update duration and delay inputs
});

// Capture inputs for duration and delay, and remove non-numeric characters
$pathList.on('input', '.input-duration', function () {
    let duration = $(this).val() || ''; // Allow empty string
    // Remove any non-numeric characters
    duration = duration.replace(/[^\d.]/g, '');
    // Update the input field with the cleaned value
    $(this).val(duration);
    
    // Track animation configuration
    if (typeof umami !== 'undefined' && duration !== '') {
        const pathIndex = $(this).closest('.path-item').index();
        umami.track('animation_configured', {
            parameter: 'duration',
            value: duration,
            path_index: pathIndex,
            total_paths: $('#path-list .path-item').length
        });
    }
    
    // Update the SVG with new duration
    updateSvgWithReversedPaths();
});

$pathList.on('input', '.input-delay', function () {
    let delay = $(this).val() || ''; // Allow empty string
    // Remove any non-numeric characters
    delay = delay.replace(/[^\d.]/g, '');
    // Update the input field with the cleaned value
    $(this).val(delay);
    
    // Track animation configuration
    if (typeof umami !== 'undefined' && delay !== '') {
        const pathIndex = $(this).closest('.path-item').index();
        umami.track('animation_configured', {
            parameter: 'delay',
            value: delay,
            path_index: pathIndex,
            total_paths: $('#path-list .path-item').length
        });
    }
    
    // Update the SVG with new delay
    updateSvgWithReversedPaths();
});

// Event listeners for easing function and type selects
$pathList.on('change', '.select-easing-function', function() {
    // Track easing function change
    if (typeof umami !== 'undefined') {
        const pathIndex = $(this).closest('.path-item').index();
        const easingFunction = $(this).val();
        const easingType = $(this).siblings('.select-easing-type').val();
        
        umami.track('animation_configured', {
            parameter: 'easing_function',
            value: easingFunction,
            easing_type: easingType,
            path_index: pathIndex,
            total_paths: $('#path-list .path-item').length
        });
    }
    
    updateSvgWithReversedPaths();
});

$pathList.on('change', '.select-easing-type', function() {
    // Track easing type change
    if (typeof umami !== 'undefined') {
        const pathIndex = $(this).closest('.path-item').index();
        const easingType = $(this).val();
        const easingFunction = $(this).siblings('.select-easing-function').val();
        
        umami.track('animation_configured', {
            parameter: 'easing_type',
            value: easingType,
            easing_function: easingFunction,
            path_index: pathIndex,
            total_paths: $('#path-list .path-item').length
        });
    }
    
    updateSvgWithReversedPaths();
});
