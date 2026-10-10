export default {
    async fetch(incomingrequest, env) {
        const corsheaders = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
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

                let responsedata = await supabaseresponse.json().catch(() => []);

                let likeslist = [];
                try {
                    const likesresponse = await fetch(supabaseurl + '/rest/v1/likes?select=*', {
                        headers: {
                            'apikey': supabasekey,
                            'authorization': 'Bearer ' + supabasekey
                        }
                    });
                    if (likesresponse.ok) {
                        likeslist = await likesresponse.json().catch(() => []);
                    }
                } catch (likesfetcherror) { }

                let commentslist = [];
                try {
                    const commentsresponse = await fetch(supabaseurl + '/rest/v1/comments?select=id,post_id', {
                        headers: {
                            'apikey': supabasekey,
                            'authorization': 'Bearer ' + supabasekey
                        }
                    });
                    if (commentsresponse.ok) {
                        commentslist = await commentsresponse.json().catch(() => []);
                    }
                } catch (commentsfetcherror) { }

                if (Array.isArray(responsedata)) {
                    responsedata = responsedata.map(singlepost => {
                        const postlikes = likeslist.filter(likeitem => likeitem.post_id === singlepost.id);
                        const postcomments = commentslist.filter(commentitem => commentitem.post_id === singlepost.id);
                        return {
                            ...singlepost,
                            likescount: postlikes.length,
                            likedusers: postlikes.map(likeitem => likeitem.user_id),
                            commentscount: postcomments.length
                        };
                    });
                }

                return new Response(JSON.stringify(responsedata), {
                    status: supabaseresponse.status,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }

            if (incomingrequest.method === 'POST') {
                const requestbody = await incomingrequest.json();
                const postcontent = requestbody.content;
                let postusername = requestbody.username || '';
                const userauth = incomingrequest.headers.get('authorization') || ('Bearer ' + supabasekey);

                if (!postusername && userauth.includes('Bearer ')) {
                    try {
                        const tokenparts = userauth.replace('Bearer ', '').trim().split('.');
                        if (tokenparts.length === 3) {
                            const tokendata = JSON.parse(atob(tokenparts[1]));
                            postusername = tokendata.user_metadata?.username || tokendata.user_metadata?.preferred_username || '';
                        }
                    } catch (tokenparseerror) { }
                }

                const postpayload = {
                    content: postcontent
                };
                if (postusername) {
                    postpayload.username = postusername;
                }

                let supabaseresponse = await fetch(supabaseurl + '/rest/v1/posts', {
                    method: 'POST',
                    headers: {
                        'apikey': supabasekey,
                        'authorization': userauth,
                        'content-type': 'application/json',
                        'prefer': 'return=representation'
                    },
                    body: JSON.stringify(postpayload)
                });

                let responsedata = await supabaseresponse.json();

                if (!supabaseresponse.ok && postusername) {
                    supabaseresponse = await fetch(supabaseurl + '/rest/v1/posts', {
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
                    responsedata = await supabaseresponse.json();
                }

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

            if (incomingrequest.method === 'DELETE') {
                const requestparams = requesturl.searchParams;
                let postid = requestparams.get('id');
                if (!postid) {
                    try {
                        const requestbody = await incomingrequest.json();
                        postid = requestbody.id;
                    } catch (bodyparseerror) { }
                }

                if (!postid) {
                    return new Response(JSON.stringify({ error: 'missing post id' }), {
                        status: 400,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const userauth = incomingrequest.headers.get('authorization') || '';
                let callerid = '';
                let callerusername = '';

                if (userauth.includes('Bearer ')) {
                    try {
                        const tokenparts = userauth.replace('Bearer ', '').trim().split('.');
                        if (tokenparts.length === 3) {
                            const tokendata = JSON.parse(atob(tokenparts[1]));
                            callerid = tokendata.sub || '';
                            callerusername = tokendata.user_metadata?.username || tokendata.user_metadata?.preferred_username || '';
                        }
                    } catch (tokenparseerror) { }
                }

                if (!callerid && !callerusername) {
                    return new Response(JSON.stringify({ error: 'unauthorized' }), {
                        status: 401,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const postcheckresponse = await fetch(supabaseurl + '/rest/v1/posts?id=eq.' + encodeURIComponent(postid), {
                    headers: {
                        'apikey': supabasekey,
                        'authorization': 'Bearer ' + supabasekey
                    }
                });

                const postrecords = await postcheckresponse.json();
                if (!postcheckresponse.ok || !postrecords || postrecords.length === 0) {
                    return new Response(JSON.stringify({ error: 'post not found' }), {
                        status: 404,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const targetpost = postrecords[0];
                const isowner = (callerid && targetpost.user_id && targetpost.user_id === callerid) || (callerusername && targetpost.username && targetpost.username === callerusername);

                if (!isowner) {
                    return new Response(JSON.stringify({ error: 'not authorized to delete this post' }), {
                        status: 403,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                let supabaseresponse = await fetch(supabaseurl + '/rest/v1/posts?id=eq.' + encodeURIComponent(postid), {
                    method: 'DELETE',
                    headers: {
                        'apikey': supabasekey,
                        'authorization': userauth,
                        'prefer': 'return=representation'
                    }
                });

                let deletedrecords = await supabaseresponse.json().catch(() => []);

                if (!supabaseresponse.ok || !deletedrecords || deletedrecords.length === 0) {
                    supabaseresponse = await fetch(supabaseurl + '/rest/v1/posts?id=eq.' + encodeURIComponent(postid), {
                        method: 'DELETE',
                        headers: {
                            'apikey': supabasekey,
                            'authorization': 'Bearer ' + supabasekey,
                            'prefer': 'return=representation'
                        }
                    });
                    deletedrecords = await supabaseresponse.json().catch(() => []);
                }

                if (!supabaseresponse.ok || !deletedrecords || deletedrecords.length === 0) {
                    return new Response(JSON.stringify({ error: 'failed to delete post in database. please run supabase delete policy.' }), {
                        status: 500,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }
        }

        if (urlpath.endsWith('/likes') && incomingrequest.method === 'POST') {
            const userauth = incomingrequest.headers.get('authorization') || '';
            let callerid = '';

            if (userauth.includes('Bearer ')) {
                try {
                    const tokenparts = userauth.replace('Bearer ', '').trim().split('.');
                    if (tokenparts.length === 3) {
                        const tokendata = JSON.parse(atob(tokenparts[1]));
                        callerid = tokendata.sub || '';
                    }
                } catch (tokenparseerror) { }
            }

            if (!callerid) {
                return new Response(JSON.stringify({ error: 'unauthorized' }), {
                    status: 401,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }

            const requestbody = await incomingrequest.json().catch(() => ({}));
            const postid = requestbody.postid;

            if (!postid) {
                return new Response(JSON.stringify({ error: 'missing post id' }), {
                    status: 400,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }

            const checklikeresponse = await fetch(supabaseurl + '/rest/v1/likes?post_id=eq.' + encodeURIComponent(postid) + '&user_id=eq.' + encodeURIComponent(callerid), {
                headers: {
                    'apikey': supabasekey,
                    'authorization': 'Bearer ' + supabasekey
                }
            });

            const existinglikes = await checklikeresponse.json().catch(() => []);

            if (Array.isArray(existinglikes) && existinglikes.length > 0) {
                await fetch(supabaseurl + '/rest/v1/likes?post_id=eq.' + encodeURIComponent(postid) + '&user_id=eq.' + encodeURIComponent(callerid), {
                    method: 'DELETE',
                    headers: {
                        'apikey': supabasekey,
                        'authorization': 'Bearer ' + supabasekey
                    }
                });

                return new Response(JSON.stringify({ liked: false }), {
                    status: 200,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            } else {
                await fetch(supabaseurl + '/rest/v1/likes', {
                    method: 'POST',
                    headers: {
                        'apikey': supabasekey,
                        'authorization': 'Bearer ' + supabasekey,
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        post_id: postid,
                        user_id: callerid
                    })
                });

                return new Response(JSON.stringify({ liked: true }), {
                    status: 200,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }
        }

        if (urlpath.endsWith('/follows')) {
            const userauth = incomingrequest.headers.get('authorization') || '';
            let callerid = '';
            let callerusername = '';

            if (userauth.includes('Bearer ')) {
                try {
                    const tokenparts = userauth.replace('Bearer ', '').trim().split('.');
                    if (tokenparts.length === 3) {
                        const tokendata = JSON.parse(atob(tokenparts[1]));
                        callerid = tokendata.sub || '';
                        callerusername = tokendata.user_metadata?.username || tokendata.user_metadata?.preferred_username || '';
                    }
                } catch (tokenparseerror) { }
            }

            if (incomingrequest.method === 'GET') {
                if (!callerid) {
                    return new Response(JSON.stringify({ following: [], followerscount: 0, followingcount: 0 }), {
                        status: 200,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                let allfollows = [];
                try {
                    const followsresponse = await fetch(supabaseurl + '/rest/v1/follows?select=*', {
                        headers: {
                            'apikey': supabasekey,
                            'authorization': 'Bearer ' + supabasekey
                        }
                    });
                    if (followsresponse.ok) {
                        allfollows = await followsresponse.json().catch(() => []);
                    }
                } catch (followsfetcherror) { }

                const myfollowing = allfollows.filter(item => item.follower_id === callerid).map(item => item.following_username);
                const myfollowers = allfollows.filter(item => item.following_username === callerusername);

                return new Response(JSON.stringify({
                    following: myfollowing,
                    followingcount: myfollowing.length,
                    followerscount: myfollowers.length
                }), {
                    status: 200,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }

            if (incomingrequest.method === 'POST') {
                if (!callerid) {
                    return new Response(JSON.stringify({ error: 'unauthorized' }), {
                        status: 401,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const requestbody = await incomingrequest.json().catch(() => ({}));
                const targetusername = requestbody.username;

                if (!targetusername) {
                    return new Response(JSON.stringify({ error: 'missing username' }), {
                        status: 400,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const checkfollowresponse = await fetch(supabaseurl + '/rest/v1/follows?follower_id=eq.' + encodeURIComponent(callerid) + '&following_username=eq.' + encodeURIComponent(targetusername), {
                    headers: {
                        'apikey': supabasekey,
                        'authorization': 'Bearer ' + supabasekey
                    }
                });

                const existingfollows = await checkfollowresponse.json().catch(() => []);

                if (Array.isArray(existingfollows) && existingfollows.length > 0) {
                    await fetch(supabaseurl + '/rest/v1/follows?follower_id=eq.' + encodeURIComponent(callerid) + '&following_username=eq.' + encodeURIComponent(targetusername), {
                        method: 'DELETE',
                        headers: {
                            'apikey': supabasekey,
                            'authorization': 'Bearer ' + supabasekey
                        }
                    });

                    return new Response(JSON.stringify({ following: false }), {
                        status: 200,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                } else {
                    await fetch(supabaseurl + '/rest/v1/follows', {
                        method: 'POST',
                        headers: {
                            'apikey': supabasekey,
                            'authorization': 'Bearer ' + supabasekey,
                            'content-type': 'application/json'
                        },
                        body: JSON.stringify({
                            follower_id: callerid,
                            follower_username: callerusername,
                            following_username: targetusername
                        })
                    });

                    return new Response(JSON.stringify({ following: true }), {
                        status: 200,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }
            }
        }

        if (urlpath.endsWith('/comments')) {
            if (incomingrequest.method === 'GET') {
                const requestparams = requesturl.searchParams;
                const postid = requestparams.get('postid');
                if (!postid) {
                    return new Response(JSON.stringify({ error: 'missing post id' }), {
                        status: 400,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const commentsresponse = await fetch(supabaseurl + '/rest/v1/comments?post_id=eq.' + encodeURIComponent(postid) + '&order=created_at.asc', {
                    headers: {
                        'apikey': supabasekey,
                        'authorization': 'Bearer ' + supabasekey
                    }
                });

                const commentsdata = await commentsresponse.json().catch(() => []);
                return new Response(JSON.stringify(commentsdata), {
                    status: commentsresponse.status,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }

            if (incomingrequest.method === 'POST') {
                const userauth = incomingrequest.headers.get('authorization') || '';
                let callerid = '';
                let callerusername = '';

                if (userauth.includes('Bearer ')) {
                    try {
                        const tokenparts = userauth.replace('Bearer ', '').trim().split('.');
                        if (tokenparts.length === 3) {
                            const tokendata = JSON.parse(atob(tokenparts[1]));
                            callerid = tokendata.sub || '';
                            callerusername = tokendata.user_metadata?.username || tokendata.user_metadata?.preferred_username || '';
                        }
                    } catch (tokenparseerror) { }
                }

                if (!callerid) {
                    return new Response(JSON.stringify({ error: 'unauthorized' }), {
                        status: 401,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const requestbody = await incomingrequest.json().catch(() => ({}));
                const postid = requestbody.postid;
                const commentcontent = (requestbody.content || '').trim();
                const parentid = requestbody.parentid || null;

                if (!postid || !commentcontent) {
                    return new Response(JSON.stringify({ error: 'missing post id or content' }), {
                        status: 400,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const insertresponse = await fetch(supabaseurl + '/rest/v1/comments', {
                    method: 'POST',
                    headers: {
                        'apikey': supabasekey,
                        'authorization': 'Bearer ' + supabasekey,
                        'content-type': 'application/json',
                        'prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        post_id: postid,
                        user_id: callerid,
                        username: callerusername || 'tether user',
                        content: commentcontent,
                        parent_id: parentid
                    })
                });

                const insertdata = await insertresponse.json().catch(() => ({}));
                if (!insertresponse.ok) {
                    return new Response(JSON.stringify({ error: insertdata.message || 'failed to add comment' }), {
                        status: insertresponse.status,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify(insertdata), {
                    status: 201,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }

            if (incomingrequest.method === 'DELETE') {
                const requestparams = requesturl.searchParams;
                let commentid = requestparams.get('id');
                if (!commentid) {
                    try {
                        const requestbody = await incomingrequest.json();
                        commentid = requestbody.id;
                    } catch (bodyparseerror) { }
                }

                if (!commentid) {
                    return new Response(JSON.stringify({ error: 'missing comment id' }), {
                        status: 400,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const userauth = incomingrequest.headers.get('authorization') || '';
                let callerid = '';
                let callerusername = '';

                if (userauth.includes('Bearer ')) {
                    try {
                        const tokenparts = userauth.replace('Bearer ', '').trim().split('.');
                        if (tokenparts.length === 3) {
                            const tokendata = JSON.parse(atob(tokenparts[1]));
                            callerid = tokendata.sub || '';
                            callerusername = tokendata.user_metadata?.username || tokendata.user_metadata?.preferred_username || '';
                        }
                    } catch (tokenparseerror) { }
                }

                if (!callerid) {
                    return new Response(JSON.stringify({ error: 'unauthorized' }), {
                        status: 401,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const commentcheckresponse = await fetch(supabaseurl + '/rest/v1/comments?id=eq.' + encodeURIComponent(commentid), {
                    headers: {
                        'apikey': supabasekey,
                        'authorization': 'Bearer ' + supabasekey
                    }
                });

                const commentrecords = await commentcheckresponse.json().catch(() => []);
                if (!commentcheckresponse.ok || !commentrecords || commentrecords.length === 0) {
                    return new Response(JSON.stringify({ error: 'comment not found' }), {
                        status: 404,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const targetcomment = commentrecords[0];
                const isowner = (callerid && targetcomment.user_id && targetcomment.user_id === callerid) || (callerusername && targetcomment.username && targetcomment.username === callerusername);

                if (!isowner) {
                    return new Response(JSON.stringify({ error: 'not authorized to delete this comment' }), {
                        status: 403,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                const deleteresponse = await fetch(supabaseurl + '/rest/v1/comments?id=eq.' + encodeURIComponent(commentid), {
                    method: 'DELETE',
                    headers: {
                        'apikey': supabasekey,
                        'authorization': 'Bearer ' + supabasekey,
                        'prefer': 'return=representation'
                    }
                });

                if (!deleteresponse.ok) {
                    return new Response(JSON.stringify({ error: 'failed to delete comment' }), {
                        status: 500,
                        headers: { ...corsheaders, 'content-type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
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

        if (urlpath.endsWith('/username')) {
            const userauth = incomingrequest.headers.get('authorization') || '';
            const username = requestbody.username || '';

            const supabaseresponse = await fetch(supabaseurl + '/auth/v1/user', {
                method: 'PUT',
                headers: {
                    'apikey': supabasekey,
                    'authorization': userauth,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    data: {
                        username: username
                    }
                })
            });

            const responsedata = await supabaseresponse.json();

            if (!supabaseresponse.ok) {
                return new Response(JSON.stringify({ error: responsedata.msg || responsedata.message || 'failed to update username' }), {
                    status: supabaseresponse.status,
                    headers: { ...corsheaders, 'content-type': 'application/json' }
                });
            }

            return new Response(JSON.stringify(responsedata), {
                status: 200,
                headers: { ...corsheaders, 'content-type': 'application/json' }
            });
        }

        if (urlpath.endsWith('/signup')) {
            const useremail = requestbody.email;
            const userpassword = requestbody.password;
            const username = requestbody.username || '';
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
                        username: username
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
