const apiurl = 'https://little-firefly-b421.desaipahal64.workers.dev/api';

const authform = document.querySelector('form');
const pageheading = document.querySelector('h3');

if (authform && pageheading) {
    authform.addEventListener('submit', async function (formevent) {
        formevent.preventDefault();
        const headingtext = pageheading.innerText.toLowerCase();

        if (headingtext.includes('up')) {
            const forminputs = authform.querySelectorAll('input');
            const firstname = forminputs[0].value;
            const lastname = forminputs[1].value;
            const useremail = forminputs[2].value;
            const userpassword = forminputs[3].value;
            const confirmpassword = forminputs[4].value;

            if (userpassword !== confirmpassword) {
                alert('passwords do not match');
                return;
            }

            const currentpath = window.location.href;
            const baseurl = currentpath.substring(0, currentpath.lastIndexOf('/') + 1);
            const redirecturl = baseurl + 'success.html';

            const fetchresponse = await fetch(apiurl + '/signup', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    firstname: firstname,
                    lastname: lastname,
                    email: useremail,
                    password: userpassword,
                    redirectto: redirecturl
                })
            });

            const responsedata = await fetchresponse.json();

            if (!fetchresponse.ok) {
                alert(responsedata.error || 'sign up failed');
            } else {
                alert('sign up successful check your email');
            }
        } else {
            const forminputs = authform.querySelectorAll('input');
            const useremail = forminputs[0].value;
            const userpassword = forminputs[1].value;

            const fetchresponse = await fetch(apiurl + '/login', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    email: useremail,
                    password: userpassword
                })
            });

            const responsedata = await fetchresponse.json();

            if (!fetchresponse.ok) {
                alert(responsedata.error || 'login failed');
            } else {
                window.location.href = 'site.html';
            }
        }
    });
}
