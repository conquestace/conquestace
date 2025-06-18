export function isAuthorized(event){
  const secret = process.env.FUNCTION_SECRET;
  if(!secret) return true; // no secret set -> allow
  const header = event.headers?.authorization || event.headers?.Authorization;
  if(!header) return false;
  if(header === secret) return true;
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' && token === secret;
}
