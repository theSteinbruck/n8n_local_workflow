import { resolveExpressions, ExpressionContext } from './src/execution/expression-resolver';

async function verifyPhase45() {
    console.log('🧪 Phase 45 Verification: Enhanced Expression Support');

    const context: ExpressionContext = {
        $json: { name: 'n8n', version: '1.0' },
        $node: {},
        $execution: { id: 'test-exec', mode: 'manual' }
    };

    // Test 1: Date functions
    console.log('\nTest 1: Date functions');
    const dateExpr = {
        now: '{{ $now }}',
        today: '{{ $today }}',
        yesterday: '{{ $yesterday }}',
        tomorrow: '{{ $tomorrow }}'
    };
    const resolvedDates = resolveExpressions(dateExpr, context);
    console.log('Resolved Dates:', resolvedDates);

    if (resolvedDates.now && resolvedDates.today && resolvedDates.yesterday && resolvedDates.tomorrow) {
        console.log('✅ Date functions resolved');
        // Basic sanity check: today should be at 00:00:00Z
        if (resolvedDates.today.endsWith('T00:00:00.000Z')) {
            console.log('✅ $today is normalized to midnight');
        }
    } else {
        console.error('❌ Date functions failed');
        process.exit(1);
    }

    // Test 2: Random Integer
    console.log('\nTest 2: Random Integer');
    const randomExpr = '{{ $randomInt(10, 20) }}';
    const val = resolveExpressions(randomExpr, context);
    console.log('Random Value (10-20):', val);
    if (typeof val === 'number' && val >= 10 && val <= 20) {
        console.log('✅ $randomInt works');
    } else {
        console.error('❌ $randomInt failed');
        process.exit(1);
    }

    // Test 3: Base64 helpers
    console.log('\nTest 3: Base64 helpers');
    const b64Expr = {
        encoded: '{{ $base64Encode("hello world") }}',
        decoded: '{{ $base64Decode("aGVsbG8gd29ybGQ=") }}'
    };
    const resolvedB64 = resolveExpressions(b64Expr, context);
    console.log('Resolved Base64:', resolvedB64);
    if (resolvedB64.encoded === 'aGVsbG8gd29ybGQ=' && resolvedB64.decoded === 'hello world') {
        console.log('✅ Base64 helpers work');
    } else {
        console.error('❌ Base64 helpers failed');
        process.exit(1);
    }

    // Test 4: Complex expression
    console.log('\nTest 4: Complex expression');
    const complexExpr = 'The execution ID is {{ $execution.id }} and a random number is {{ $randomInt(1, 1) }}';
    const resolvedComplex = resolveExpressions(complexExpr, context);
    console.log('Resolved Complex:', resolvedComplex);
    if (resolvedComplex === 'The execution ID is test-exec and a random number is 1') {
        console.log('✅ Complex expression works');
    } else {
        console.error('❌ Complex expression failed');
        process.exit(1);
    }

    console.log('\n🎉 Phase 45 Verified!');
    process.exit(0);
}

verifyPhase45().catch(console.error);
