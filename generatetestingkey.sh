mkdir -p ~/.private
# ES512
# private key
openssl ecparam -genkey -name secp521r1 -noout -out ~/.private/ubimqtt-testing-key.pem
# public key
openssl ec -in ~/.private/ubimqtt-testing-key.pem -pubout -out ~/.private/ubimqtt-testing-key-public.pem
