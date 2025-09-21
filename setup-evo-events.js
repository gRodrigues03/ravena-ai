(function() {
    const labelsToEnsureAreChecked = [
        'MESSAGES_UPSERT',
        'GROUP_PARTICIPANTS_UPDATE',
        'GROUPS_UPSERT',
        'CONNECTION_UPDATE',
        'CONTACTS_UPDATE',
        'SEND_MESSAGE'
    ];

    const delay = 100;

    const allLabels = document.querySelectorAll('label');
    
    let toggledCount = 0;
    let currentIndex = 0;

    function processNextLabel() {
        if (currentIndex >= allLabels.length) {
            console.log(`--- Script finished. Toggled ${toggledCount} switch(es) to the correct state. ---`);
            return;
        }

        const label = allLabels[currentIndex];
        const labelText = label.textContent.trim();
        
        const button = label.nextElementSibling;

        if (button && button.tagName === 'BUTTON' && button.getAttribute('role') === 'switch') {
            const isCurrentlyChecked = button.getAttribute('aria-checked') === 'true';
            
            const shouldBeChecked = labelsToEnsureAreChecked.includes(labelText);

            if (isCurrentlyChecked !== shouldBeChecked) {
                if (shouldBeChecked) {
                    console.log(`Setting to CHECKED: ${labelText}`);
                } else {
                    console.log(`Setting to UNCHECKED: ${labelText}`);
                }
                button.click();
                toggledCount++;
            }
        }
        
        currentIndex++;
        setTimeout(processNextLabel, delay);
    }

    console.log(`Starting script with a ${delay}ms delay between actions...`);
    processNextLabel();
})();

