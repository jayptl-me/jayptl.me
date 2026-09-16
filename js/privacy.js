// Attach event listeners for privacy page actions
document.addEventListener('DOMContentLoaded', () => {
    const clearBtn = document.getElementById('clearDataBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('This will clear all stored preferences including theme settings and analytics consent. Continue?')) {
                try {
                    localStorage.clear();
                } catch (e) { }

                // Best-effort cookie clearing
                document.cookie.split(';').forEach(function (c) {
                    try {
                        if (!c) return;
                        var eqIdx = c.indexOf('=');
                        var name = (eqIdx > -1 ? c.slice(0, eqIdx) : c).trim();
                        var expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
                        // Delete at root path
                        document.cookie = name + '=;expires=' + expires + ';path=/';
                    } catch (e) { }
                });

                alert('All data cleared successfully. The page will reload.');
                window.location.reload();
            }
        });
    }

    const privacySettingsBtn = document.getElementById('privacySettingsBtn');
    if (privacySettingsBtn) {
        privacySettingsBtn.addEventListener('click', () => {
            window.consentBanner?.showConsentSettings();
        });
    }
});
