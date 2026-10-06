//this code is not used here. it's deployed on a clouldflare worker

export default {
    async fetch(incomingrequest, env) {
        const corsheaders = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, GET, OPTIONS',
            'access-control-allow-headers': 'content-type, authorization'
        };

        if (incomingrequest.method === 'OPTIONS') {
            return new Response(null, { headers: corsheaders });
        }

        const requesturl = new URL(incomingrequest.url);
        const urlpath = requesturl.pathname;
        const supabaseurl = env.SUPABASE_URL;
        const supabasekey = env.SUPABASE_ANON_KEY;

        if (urlpath.endsWith('/google')) {
            const redirectto = requesturl.searchParams.get('redirectto');
            const authurl = supabaseurl + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(redirectto);
            return Response.redirect(authurl, 302);
        }

        if (urlpath.endsWith('/github')) {
            const redirectto = requesturl.searchParams.get('redirectto');
            const authurl = supabaseurl + '/auth/v1/authorize?provider=github&redirect_to=' + encodeURIComponent(redirectto);
            return Response.redirect(authurl, 302);
        }

        if (urlpath.endsWith('/posts')) {
            if (incomingrequest.method === 'GET') {
                const supabaseresponse = await fetch(supabaseurl + '/rest/v1/posts?select=*&order=created_at.desc', {
                    headers: {
                        'apikey': supabasekey,
                        'authorization': 'Bearer ' + supabasekey
                    }
                });

                const responsedata = await supabaseresponse.json();

                return new Response(JSON.stringify(responsedata), {
                    status: supabaseresponse.status,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }

            if (incomingrequest.method === 'POST') {
                const requestbody = await incomingrequest.json();
                const postcontent = requestbody.content;
                const userauth = incomingrequest.headers.get('authorization') || ('Bearer ' + supabasekey);

                const supabaseresponse = await fetch(supabaseurl + '/rest/v1/posts', {
                    method: 'POST',
                    headers: {
                        'apikey': supabasekey,
                        'authorization': userauth,
                        'content-type': 'application/json',
                        'prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        content: postcontent
                    })
                });

                const responsedata = await supabaseresponse.json();

                if (!supabaseresponse.ok) {
                    return new Response(JSON.stringify({ error: responsedata.message || 'failed to create post' }), {
                        status: supabaseresponse.status,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify(responsedata), {
                    status: 201,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }
        }

        if (incomingrequest.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'method not allowed' }), {
                status: 405,
                headers: { ...corsheaders, 'content-type': 'application/json' }
            });
        }

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
