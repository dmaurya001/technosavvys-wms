import { NextRequest, NextResponse } from 'next/server';
import { extractAndValidateSession } from '@/lib/sessionManager';
import { getAllWorkshops, saveWorkshop, deleteWorkshop } from '@/lib/workshopStore';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const workshops = await getAllWorkshops();
    return NextResponse.json({
      success: true,
      count: workshops.length,
      workshops,
    });
  } catch (err: any) {
    console.error('[API /api/workshops GET Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error fetching workshops.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAndValidateSession(request);
    if (!auth.valid || !auth.session || auth.session.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Forbidden: Teacher or Administrator access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (!body || !body.title) {
      return NextResponse.json(
        { error: 'Workshop title is required.' },
        { status: 400 }
      );
    }

    const saved = await saveWorkshop(body);

    await logAuditEvent({
      action: 'CREATE_WORKSHOP',
      entityType: 'Workshop',
      entityId: saved.id,
      details: {
        title: saved.title,
        category: saved.category,
        createdBy: auth.session.email,
      },
    });

    return NextResponse.json({
      success: true,
      workshop: saved,
    });
  } catch (err: any) {
    console.error('[API /api/workshops POST Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to save workshop.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = extractAndValidateSession(request);
    if (!auth.valid || !auth.session || auth.session.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Forbidden: Teacher or Administrator access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Workshop ID is required for deletion.' },
        { status: 400 }
      );
    }

    const deleted = await deleteWorkshop(id);

    await logAuditEvent({
      action: 'DELETE_WORKSHOP',
      entityType: 'Workshop',
      entityId: id,
      details: { deletedBy: auth.session.email },
    });

    return NextResponse.json({
      success: true,
      deleted,
    });
  } catch (err: any) {
    console.error('[API /api/workshops DELETE Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete workshop.' },
      { status: 500 }
    );
  }
}
