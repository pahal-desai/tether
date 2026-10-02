export default {
    async fetch(incomingrequest, env) {
        const corsheaders = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type'
        };

        if (incomingrequest.method === 'OPTIONS') {
            return new Response(null, { headers: corsheaders });
        }

        const requesturl = new URL(incomingrequest.url);
        const urlpath = requesturl.pathname;

        if (incomingrequest.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'method not allowed' }), {
                status: 405,
                headers: { ...corsheaders, 'content-type': 'application/json' }
            });
        }

        const supabaseurl = env.SUPABASE_URL;
        const supabasekey = env.SUPABASE_ANON_KEY;

        const requestbody = await incomingrequest.json();

        if (urlpath.endsWith('/signup')) {
            const useremail = requestbody.email;
            const userpassword = requestbody.password;
            const firstname = requestbody.firstname;
            const lastname = requestbody.lastname;
            const redirectto = requestbody.redirectto;

            let signuppath = supabaseurl + '/auth/v1/signup';
            if (redirectto) {
                signuppath = signuppath + '?redirect_to=' + encodeURIComponent(redirectto);
            }

            const supabaseresponse = await fetch(signuppath, {
                method: 'POST',
                headers: {
                    'apikey': supabasekey,
                    'authorization': 'Bearer ' + supabasekey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    email: useremail,
                    password: userpassword,
                    data: {
                        firstname: firstname,
                        lastname: lastname
                    }
                })
            });

            const responsedata = await supabaseresponse.json();

            if (!supabaseresponse.ok) {
                return new Response(JSON.stringify({ error: responsedata.msg || responsedata.message || 'signup failed' }), {
                    status: supabaseresponse.status,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }

            return new Response(JSON.stringify(responsedata), {
                status: 200,
                headers: { ...corsheaders, 'content-type': 'application/json' }
            });
        }

        if (urlpath.endsWith('/login')) {
            const useremail = requestbody.email;
            const userpassword = requestbody.password;

            const supabaseresponse = await fetch(supabaseurl + '/auth/v1/token?grant_type=password', {
                method: 'POST',
                headers: {
                    'apikey': supabasekey,
                    'authorization': 'Bearer ' + supabasekey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    email: useremail,
                    password: userpassword
                })
            });

            const responsedata = await supabaseresponse.json();

            if (!supabaseresponse.ok) {
                return new Response(JSON.stringify({ error: responsedata.error_description || responsedata.msg || 'login failed' }), {
                    status: supabaseresponse.status,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }

            return new Response(JSON.stringify(responsedata), {
                status: 200,
                headers: { ...corsheaders, 'content-type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'not found' }), {
            status: 404,
            headers: { ...corsheaders, 'content-type': 'application/json' }
        });
    }
};
